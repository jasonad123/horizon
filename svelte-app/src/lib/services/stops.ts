import { apiCache } from '$lib/utils/apiCache';
import { mergeItineraries } from '$lib/utils/itineraryUtils';
import { shouldShowDeparture } from '$lib/utils/departureFilters';
import type { Route } from './nearby';

export interface Stop {
	global_stop_id: string;
	stop_name: string;
	stop_code?: string;
	stop_lat: number;
	stop_lon: number;
	distance?: number;
	route_type?: number;
	city_name?: string;
	parent_station?: {
		global_stop_id?: string;
		station_name?: string;
		station_code?: string;
		city_name?: string;
	};
	network_name?: string;
	tts_stop_name?: string;
}

export interface NearbyStopsResponse {
	stops: Stop[];
}

// Returns stops near a location — used during setup for stop/bay selection.
export async function findNearbyStops(
	lat: number,
	lon: number,
	maxDistance: number = 500
): Promise<Stop[]> {
	const params = {
		lat: lat.toString(),
		lon: lon.toString(),
		max_distance: Math.min(maxDistance, 1500).toString()
	};

	return apiCache.fetch('/api/stops/nearby', params, async () => {
		const urlParams = new URLSearchParams(params);
		const response = await fetch(`/api/stops/nearby?${urlParams}`);
		if (!response.ok) throw new Error('Failed to fetch nearby stops');
		const data: NearbyStopsResponse = await response.json();
		return data.stops || [];
	});
}

// Returns upcoming departures for one or more specific stop IDs.
// The server transforms stop_departures to the same { routes } shape as nearby_routes,
// so the return type is Route[] and DepartureBoard can use identical flattening logic.
export async function fetchStopDepartures(
	stopIds: string[],
	maxDepartures: number = 6
): Promise<Route[]> {
	if (stopIds.length === 0) return [];

	const params = {
		global_stop_ids: stopIds.join(','),
		max_num_departures: Math.min(maxDepartures, 10).toString()
	};

	return apiCache
		.fetch('/api/stops/departures', params, async () => {
			const urlParams = new URLSearchParams(params);
			const response = await fetch(`/api/stops/departures?${urlParams}`);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));

				if (response.status === 429) {
					const error = Object.assign(new Error('Rate limit exceeded'), {
						retryAfter: errorData.retryAfter || 60,
						isRateLimit: true as const
					});
					throw error;
				}
				if (response.status === 401 || response.status === 403) {
					throw Object.assign(new Error('Authentication failed'), { isAuthError: true as const });
				}
				if (response.status === 504) {
					throw Object.assign(new Error('Request timed out'), { isTimeout: true as const });
				}
				throw new Error(errorData.message || 'Failed to fetch stop departures');
			}

			const data = await response.json();
			return data.routes || [];
		})
		.then((routes) =>
			routes.map((route: Route) => ({
				...route,
				itineraries: route.itineraries ? mergeItineraries(route.itineraries) : undefined
			}))
		)
		.then((routes) =>
			routes.map((route: Route) => ({
				...route,
				itineraries: route.itineraries?.filter((itin) =>
					itin.schedule_items?.some((item) => shouldShowDeparture(item.departure_time))
				)
			}))
		)
		.then((routes) => routes.filter((r: Route) => r.itineraries && r.itineraries.length > 0));
}
