import { apiCache } from '$lib/utils/apiCache';
import { mergeItineraries } from '$lib/utils/itineraryUtils';
import { shouldShowDeparture } from '$lib/utils/departureFilters';

export interface Route {
	global_route_id: string;
	route_short_name?: string;
	route_long_name?: string;
	mode_name?: string;
	route_color: string;
	route_text_color: string;
	route_display_short_name?: {
		elements: string[];
		route_name_redundancy?: boolean;
		boxed_text?: string;
	};
	compact_display_short_name?: {
		elements: string[];
		route_name_redundancy?: boolean;
		boxed_text?: string;
	};
	sorting_key?: string;
	tts_short_name?: string;
	branch_code?: string;
	route_network_name?: string;
	itineraries?: Itinerary[];
	alerts?: Alert[];
}

export interface Itinerary {
	closest_stop?: {
		stop_name: string;
		stop_code?: string;
		global_stop_id?: string;
		stop_lat?: number;
		stop_lon?: number;
		parent_station?: {
			global_stop_id?: string;
			station_name?: string;
			station_code?: string;
		};
	};
	merged_headsign?: string;
	direction_id?: number;
	direction_headsign?: string;
	headsign?: string;
	variant_id?: string;
	canonical_itinerary?: boolean;
	branch_code?: string;
	internal_itinerary_id?: string;
	schedule_items?: ScheduleItem[];
}

export interface ScheduleItem {
	departure_time: number;
	arrival_time?: number;
	scheduled_departure_time?: number;
	scheduled_arrival_time?: number;
	is_real_time?: boolean;
	is_cancelled?: boolean;
	trip_search_key?: string;
}

export interface Alert {
	effect: string;
	cause?: string;
	severity: string;
	title?: string;
	description: string;
	created_at: number;
	active_periods?: { start: number | null; end: number | null }[];
}

export interface LatLng {
	latitude: number;
	longitude: number;
}

export interface RateLimitError extends Error {
	retryAfter?: number;
	isRateLimit: true;
}

export interface AuthenticationError extends Error {
	isAuthError: true;
}

export interface TimeoutError extends Error {
	isTimeout: true;
}

export interface BackendError extends Error {
	isBackendError: true;
}

export type ApiError = RateLimitError | AuthenticationError | TimeoutError | BackendError;

export async function findNearbyRoutes(location: LatLng, radius: number): Promise<Route[]> {
	const params = {
		lat: location.latitude.toString(),
		lon: location.longitude.toString(),
		max_distance: radius.toString()
	};

	return apiCache
		.fetch('/api/routes/nearby', params, async () => {
			const urlParams = new URLSearchParams(params);
			const response = await fetch(`/api/routes/nearby?${urlParams}`);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));

				if (response.status === 429) {
					const error = new Error(errorData.message || 'Rate limit exceeded') as RateLimitError;
					error.retryAfter = errorData.retryAfter || 60;
					error.isRateLimit = true;
					throw error;
				}
				if (response.status === 401 || response.status === 403) {
					const error = new Error('Authentication failed') as AuthenticationError;
					error.isAuthError = true;
					throw error;
				}
				if (response.status === 504) {
					const error = new Error('Request timed out') as TimeoutError;
					error.isTimeout = true;
					throw error;
				}
				if (response.status === 503) {
					const error = new Error('Service temporarily unavailable') as BackendError;
					error.isBackendError = true;
					throw error;
				}
				throw new Error(errorData.message || errorData.error || 'Failed to fetch nearby routes');
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
