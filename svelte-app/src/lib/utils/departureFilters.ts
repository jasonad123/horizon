export function shouldShowDeparture(departureTime: number, now = Date.now()): boolean {
	const diffMs = departureTime * 1000 - now;
	return diffMs > -30000 && diffMs <= 130 * 60000;
}
