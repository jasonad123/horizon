'use strict';

const config = require('../../config/environment');

function haversine(lat1, lon1, lat2, lon2) {
	const R = 6371000;
	const phi1 = (lat1 * Math.PI) / 180;
	const phi2 = (lat2 * Math.PI) / 180;
	const dphi = ((lat2 - lat1) * Math.PI) / 180;
	const dlambda = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dphi / 2) * Math.sin(dphi / 2) +
		Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) * Math.sin(dlambda / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function transformV4ToV3Format(v4Response) {
	if (!v4Response || !v4Response.nearby_routes) return v4Response;

	const routes = v4Response.nearby_routes.map((route) => {
		const flattenedRoute = { ...route };
		delete flattenedRoute.merged_itineraries;

		const allItineraries = [];
		const allScheduleItems = [];
		const scheduleItemsByItineraryId = {};

		if (Array.isArray(route.merged_itineraries)) {
			for (const merged of route.merged_itineraries) {
				if (Array.isArray(merged.schedule_items)) {
					for (const scheduleItem of merged.schedule_items) {
						const itineraryId = scheduleItem.internal_itinerary_id;
						if (!scheduleItemsByItineraryId[itineraryId]) {
							scheduleItemsByItineraryId[itineraryId] = [];
						}
						const { internal_itinerary_id, ...itemWithoutId } = scheduleItem;
						scheduleItemsByItineraryId[itineraryId].push(itemWithoutId);
					}
					allScheduleItems.push(...merged.schedule_items);
				}
			}

			for (const merged of route.merged_itineraries) {
				if (Array.isArray(merged.itineraries)) {
					const itinerariesWithData = merged.itineraries.map((itinerary) => ({
						...itinerary,
						closest_stop: merged.closest_stop,
						schedule_items: scheduleItemsByItineraryId[itinerary.internal_itinerary_id] || []
					}));
					allItineraries.push(...itinerariesWithData);
				}
			}
		}

		return {
			...flattenedRoute,
			itineraries: allItineraries,
			schedule_items: allScheduleItems
		};
	});

	return { routes };
}

function hasRealTimeData(data) {
	if (!data || typeof data !== 'object') return false;
	const routes = data.routes || data;
	if (!Array.isArray(routes)) return false;
	for (const route of routes) {
		if (route.itineraries && Array.isArray(route.itineraries)) {
			for (const itinerary of route.itineraries) {
				if (
					itinerary.schedule_items &&
					itinerary.schedule_items.some((item) => item.is_real_time === true)
				) {
					return true;
				}
			}
		}
	}
	return false;
}

function hasActiveAlerts(data) {
	const routes = data?.routes;
	if (!Array.isArray(routes)) return false;
	return routes.some((route) => Array.isArray(route.alerts) && route.alerts.length > 0);
}

const CACHE_ENABLED = config.parseBoolean(process.env.ENABLE_SERVER_CACHE);
const REALTIME_CACHE_TTL = parseInt(process.env.REALTIME_CACHE_TTL) || 5000;
const STATIC_CACHE_TTL = parseInt(process.env.STATIC_CACHE_TTL) || 120000;
const MAX_CACHE_SIZE = 100;

function getCacheMaxAge(freshness) {
	return freshness === 'fresh-realtime' ? Math.floor(REALTIME_CACHE_TTL / 1000) : Math.floor(STATIC_CACHE_TTL / 1000);
}

const requestCache = new Map();
const pendingRequests = new Map();

let cleanupInterval = null;
if (CACHE_ENABLED) {
	cleanupInterval = setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of requestCache.entries()) {
			if (now > entry.expiresAt) requestCache.delete(key);
		}
		if (requestCache.size > MAX_CACHE_SIZE) {
			const keys = Array.from(requestCache.keys());
			for (let i = 0; i < requestCache.size - MAX_CACHE_SIZE; i++) requestCache.delete(keys[i]);
		}
	}, 60000);
}

exports.cleanup = function () {
	if (cleanupInterval) { clearInterval(cleanupInterval); cleanupInterval = null; }
	requestCache.clear();
	pendingRequests.clear();
};

exports.nearby = async function (req, res) {
	const { lat, lon, max_distance } = req.query;

	if (!lat || !lon) {
		return res.status(400).json({ error: 'Missing required parameters: lat and lon' });
	}

	if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
		return res.status(400).json({ error: 'lat and lon must be valid numbers' });
	}

	const distance = max_distance ? parseInt(max_distance, 10) : 1000;
	if (isNaN(distance) || distance < 0) {
		return res.status(400).json({ error: 'Invalid max_distance parameter' });
	}

	const roundedLat = parseFloat(lat).toFixed(4);
	const roundedLon = parseFloat(lon).toFixed(4);
	const cacheKey = `nearby:${roundedLat},${roundedLon},${distance}`;

	if (CACHE_ENABLED) {
		const cached = requestCache.get(cacheKey);
		if (cached && Date.now() < cached.expiresAt) {
			const maxAge = getCacheMaxAge(cached.freshness || 'fresh-schedule');
			res.set({ 'Cache-Control': `public, max-age=${maxAge}`, 'X-Cache': 'HIT' });
			return res.status(200).json(cached.data);
		}

		const pending = pendingRequests.get(cacheKey);
		if (pending) {
			try {
				const data = await Promise.race([
					pending,
					new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
				]);
				res.set({ 'Cache-Control': 'public, max-age=3', 'X-Cache': 'HIT-INFLIGHT' });
				return res.status(200).json(data);
			} catch (_) { /* fall through */ }
		}
	}

	const fetchPromise = (async () => {
		try {
			const response = await fetch(
				`https://external.transitapp.com/v4/public/nearby_routes?lat=${lat}&lon=${lon}&max_distance=${distance}&max_num_departures=6`,
				{
					headers: { Accept: 'application/json', 'Content-Type': 'application/json', apiKey: process.env.TRANSIT_API_KEY },
					signal: AbortSignal.timeout(10000)
				}
			);

			if (!response.ok) {
				const body = await response.text();
				if (response.status === 429) {
					const retryAfter = response.headers.get('Retry-After');
					const error = new Error('Rate limit exceeded');
					error.status = 429;
					error.retryAfter = retryAfter ? parseInt(retryAfter) : 60;
					throw error;
				}
				const error = new Error('Transit API error');
				error.status = response.status;
				throw error;
			}

			const v4Data = await response.json();
			const data = transformV4ToV3Format(v4Data);

			if (data.routes && Array.isArray(data.routes)) {
				data.routes = data.routes.filter((route) =>
					route.itineraries &&
					route.itineraries.some((itinerary) => {
						if (!itinerary.closest_stop) return false;
						const dist = haversine(
							parseFloat(lat), parseFloat(lon),
							itinerary.closest_stop.stop_lat, itinerary.closest_stop.stop_lon
						);
						return dist <= distance;
					})
				);
			}

			if (CACHE_ENABLED) {
				const isRealTime = hasRealTimeData(data);
				const cacheTTL = isRealTime || hasActiveAlerts(data) ? REALTIME_CACHE_TTL : STATIC_CACHE_TTL;
				requestCache.set(cacheKey, { data, expiresAt: Date.now() + cacheTTL, freshness: isRealTime ? 'fresh-realtime' : 'fresh-schedule' });
			}

			return data;
		} finally {
			if (CACHE_ENABLED) pendingRequests.delete(cacheKey);
		}
	})();

	if (CACHE_ENABLED) pendingRequests.set(cacheKey, fetchPromise);

	try {
		const data = await fetchPromise;
		const isRealTime = hasRealTimeData(data);
		const freshness = isRealTime ? 'fresh-realtime' : 'fresh-schedule';
		res.set({
			'Cache-Control': `public, max-age=${getCacheMaxAge(freshness)}`,
			'Vary': 'Accept-Encoding',
			'X-Cache': CACHE_ENABLED ? 'MISS' : 'DISABLED',
			'X-Cache-Freshness': freshness
		});
		res.status(200).json(data);
	} catch (error) {
		req.log.error({ api: 'transit', endpoint: 'nearby_routes', err: error }, 'Error fetching nearby routes');

		if (error.name === 'TimeoutError' || error.name === 'AbortError') {
			return res.status(504).json({ error: 'Request timeout' });
		}
		if (error.status === 429) {
			return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: error.retryAfter || 60 });
		}
		if (error.status === 401 || error.status === 403) {
			return res.status(error.status).json({ error: 'Authentication error' });
		}
		if (error.status) return res.status(error.status).json({ error: 'Transit API error' });
		return res.status(500).json({ error: 'Failed to fetch nearby routes' });
	}
};
