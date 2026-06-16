interface CacheEntry<T> {
	data: T;
	timestamp: number;
	expiresAt: number;
	freshness: 'realtime' | 'schedule';
}

interface PendingRequest<T> {
	promise: Promise<T>;
	timestamp: number;
}

function hasRealTimeData(data: unknown): boolean {
	if (!data || typeof data !== 'object') return false;
	const routes = (data as Record<string, unknown>).routes ?? data;
	if (!Array.isArray(routes)) return false;
	for (const route of routes) {
		for (const itin of (route as Record<string, unknown[]>).itineraries ?? []) {
			const items = (itin as Record<string, unknown[]>).schedule_items ?? [];
			if (items.some((item) => (item as Record<string, unknown>).is_real_time === true)) return true;
		}
	}
	return false;
}

function hasActiveAlerts(data: unknown): boolean {
	const d = data as Record<string, unknown>;
	const routes = (d?.routes ?? data) as unknown[];
	if (!Array.isArray(routes)) return false;
	return routes.some((r) => {
		const alerts = (r as Record<string, unknown>).alerts;
		return Array.isArray(alerts) && alerts.length > 0;
	});
}

class ApiCache {
	private cache = new Map<string, CacheEntry<unknown>>();
	private pendingRequests = new Map<string, PendingRequest<unknown>>();
	private realtimeTTL = parseInt(import.meta.env.VITE_REALTIME_CACHE_TTL || '5000');
	private scheduleTTL = parseInt(import.meta.env.VITE_STATIC_CACHE_TTL || '120000');

	getCacheKey(endpoint: string, params: Record<string, string>): string {
		const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
		return `${endpoint}?${sorted}`;
	}

	get<T>(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) return null;
		if (Date.now() > entry.expiresAt) { this.cache.delete(key); return null; }
		return entry.data as T;
	}

	set<T>(key: string, data: T, ttl: number, freshness: 'realtime' | 'schedule'): void {
		this.cache.set(key, { data, timestamp: Date.now(), expiresAt: Date.now() + ttl, freshness });
	}

	async fetch<T>(
		endpoint: string,
		params: Record<string, string>,
		fetcher: () => Promise<T>
	): Promise<T> {
		const key = this.getCacheKey(endpoint, params);
		const cached = this.get<T>(key);
		if (cached !== null) return cached;

		const pending = this.pendingRequests.get(key);
		if (pending) return pending.promise as Promise<T>;

		const promise = fetcher().then(
			(data) => {
				const isRealTime = hasRealTimeData(data);
				const freshness = isRealTime ? 'realtime' : 'schedule';
				const ttl = isRealTime || hasActiveAlerts(data) ? this.realtimeTTL : this.scheduleTTL;
				this.set(key, data, ttl, freshness);
				this.pendingRequests.delete(key);
				return data;
			},
			(error) => {
				this.pendingRequests.delete(key);
				throw error;
			}
		);

		this.pendingRequests.set(key, { promise, timestamp: Date.now() });
		return promise;
	}

	clear(): void { this.cache.clear(); this.pendingRequests.clear(); }

	clearExpired(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) this.cache.delete(key);
		}
		for (const [key, pending] of this.pendingRequests.entries()) {
			if (now - pending.timestamp > 20000) this.pendingRequests.delete(key);
		}
	}
}

export const apiCache = new ApiCache();

if (typeof window !== 'undefined') {
	setInterval(() => apiCache.clearExpired(), 60000);
}
