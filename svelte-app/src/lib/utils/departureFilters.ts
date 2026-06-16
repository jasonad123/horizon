import { getMinutesUntil } from './timeUtils';

export function shouldShowDeparture(departureTime: number): boolean {
	const minutes = getMinutesUntil(departureTime);
	return minutes >= 0 && minutes <= 120;
}
