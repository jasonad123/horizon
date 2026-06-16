export function getMinutesUntil(departureTime: number): number {
	return Math.round((departureTime * 1000 - Date.now()) / 60000);
}

export function formatCountdown(departureTime: number): string {
	const minutes = Math.round((departureTime * 1000 - Date.now()) / 60000);
	return minutes <= 0 ? 'Due' : `${minutes} min`;
}

export function formatClock(date: Date, format: 'HH:mm' | 'hh:mm A' | 'HH:mm:ss'): string {
	if (format === 'HH:mm:ss') {
		return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}
	if (format === 'HH:mm') {
		return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
	}
	return date.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
}
