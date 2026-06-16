import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface LatLng {
	latitude: number;
	longitude: number;
}

export interface HorizonConfig {
	title: string;
	location: LatLng | null;
	maxDistance: number;
	selectedStopIds: string[];
	timeFormat: 'HH:mm' | 'hh:mm A';
	maxDepartures: number;
	loaded: boolean;
}

const defaultConfig: HorizonConfig = {
	title: 'Horizon',
	location: null,
	maxDistance: 500,
	selectedStopIds: [],
	timeFormat: 'HH:mm',
	maxDepartures: 12,
	loaded: false
};

function createConfigStore() {
	const { subscribe, set, update } = writable<HorizonConfig>(defaultConfig);

	return {
		subscribe,
		set,
		update,

		async load() {
			if (!browser) return;

			try {
				const response = await fetch('/api/config/unattended');
				if (!response.ok) {
					set({ ...defaultConfig, loaded: true });
					return;
				}

				const data = await response.json();

				set({
					title: data.title || 'Horizon',
					location: data.latLng
						? { latitude: data.latLng.latitude, longitude: data.latLng.longitude }
						: null,
					maxDistance: data.maxDistance || 500,
					selectedStopIds: Array.isArray(data.selectedStops) ? data.selectedStops : [],
					timeFormat: data.timeFormat === 'hh:mm A' ? 'hh:mm A' : 'HH:mm',
					maxDepartures: data.maxDepartures || 12,
					loaded: true
				});
			} catch {
				set({ ...defaultConfig, loaded: true });
			}
		}
	};
}

export const config = createConfigStore();
