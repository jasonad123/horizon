export function shouldShowDeparture(departureTime: number): boolean {
	const diffMs = departureTime * 1000 - Date.now();
	return diffMs > -30000 && diffMs <= 130 * 60000;
}
