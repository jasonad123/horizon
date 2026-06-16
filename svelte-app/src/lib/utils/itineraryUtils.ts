import type { Itinerary, ScheduleItem } from '$lib/services/nearby';

function getMergeKey(itinerary: Itinerary): string {
	const dir = itinerary.direction_id ?? 'undefined';
	const sign = itinerary.merged_headsign || itinerary.direction_headsign || 'unknown';
	return `${dir}:${sign}`;
}

function mergeScheduleItems(itineraries: Itinerary[]): ScheduleItem[] {
	const all: ScheduleItem[] = [];
	for (const itin of itineraries) {
		if (itin.schedule_items) all.push(...itin.schedule_items);
	}
	return all.sort((a, b) => a.departure_time - b.departure_time);
}

export function mergeItineraries(itineraries: Itinerary[]): Itinerary[] {
	if (!itineraries || itineraries.length === 0) return [];

	const groups = new Map<string, Itinerary[]>();
	for (const itin of itineraries) {
		const key = getMergeKey(itin);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(itin);
	}

	const result: Itinerary[] = [];
	for (const group of groups.values()) {
		if (group.length === 1) { result.push(group[0]); continue; }
		result.push({ ...group[0], schedule_items: mergeScheduleItems(group) });
	}
	return result;
}
