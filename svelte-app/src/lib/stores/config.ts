import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type FilterMode = 'all' | 'routes' | 'stops';

export interface LatLng {
	latitude: number;
	longitude: number;
}

export interface HorizonConfig {
	title: string;
	location: LatLng | null;
	maxDistance: number;
	filterMode: FilterMode;
	selectedStopIds: string[];
	selectedRouteIds: string[];
	timeFormat: 'HH:mm' | 'hh:mm A';
	maxDepartures: number;
	loaded: boolean;
}

const defaultConfig: HorizonConfig = {
	title: 'Horizon',
	location: null,
	maxDistance: 500,
	filterMode: 'all',
	selectedStopIds: [],
	selectedRouteIds: [],
	timeFormat: 'HH:mm',
	maxDepartures: 8,
	loaded: false
};

const STORAGE_KEY = 'horizon-config';

function parseStoredConfig(raw: string): Partial<HorizonConfig> | null {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function createConfigStore() {
	const { subscribe, set, update } = writable<HorizonConfig>(defaultConfig);

	return {
		subscribe,
		set,
		update,

		async load() {
			if (!browser) return;

			// localStorage takes priority over env-var unattended config
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = parseStoredConfig(stored);
				if (parsed) {
					set({
						title: parsed.title || 'Horizon',
						location: parsed.location || null,
						maxDistance: parsed.maxDistance || 500,
						filterMode: parsed.filterMode || 'all',
						selectedStopIds: Array.isArray(parsed.selectedStopIds) ? parsed.selectedStopIds : [],
						selectedRouteIds: Array.isArray(parsed.selectedRouteIds) ? parsed.selectedRouteIds : [],
						timeFormat: parsed.timeFormat === 'hh:mm A' ? 'hh:mm A' : 'HH:mm',
						maxDepartures: parsed.maxDepartures || 8,
						loaded: true
					});
					return;
				}
			}

			// Fall back to unattended env config from server
			try {
				const response = await fetch('/api/config/unattended');
				if (!response.ok) {
					set({ ...defaultConfig, loaded: true });
					return;
				}

				const data = await response.json();
				const hasStops = Array.isArray(data.selectedStops) && data.selectedStops.length > 0;

				set({
					title: data.title || 'Horizon',
					location: data.latLng
						? { latitude: data.latLng.latitude, longitude: data.latLng.longitude }
						: null,
					maxDistance: data.maxDistance || 500,
					filterMode: hasStops ? 'stops' : 'all',
					selectedStopIds: hasStops ? data.selectedStops : [],
					selectedRouteIds: [],
					timeFormat: data.timeFormat === 'hh:mm A' ? 'hh:mm A' : 'HH:mm',
					maxDepartures: data.maxDepartures || 8,
					loaded: true
				});
			} catch {
				set({ ...defaultConfig, loaded: true });
			}
		},

		save(updates: Partial<Omit<HorizonConfig, 'loaded'>>) {
			if (!browser) return;
			update((current) => {
				const next: HorizonConfig = { ...current, ...updates, loaded: true };
				try {
					const { loaded: _, ...toStore } = next;
					localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
				} catch { /* quota exceeded, etc. */ }
				return next;
			});
		},

		reset() {
			if (!browser) return;
			try { localStorage.removeItem(STORAGE_KEY); } catch {}
			set({ ...defaultConfig, loaded: true });
		}
	};
}

export const config = createConfigStore();
