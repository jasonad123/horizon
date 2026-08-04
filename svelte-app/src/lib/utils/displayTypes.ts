import type { Route, Itinerary } from '$lib/services/nearby';

export interface DirectionEntry {
	route: Route;
	itinerary: Itinerary;
	showBadge: boolean;
	groupIndex: number;
}
