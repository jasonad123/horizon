export function getMinutesUntil(departureTime: number): number {
	return Math.round((departureTime * 1000 - Date.now()) / 60000);
}

export function formatCountdown(departureTime: number, now = Date.now()): string {
	const minutes = Math.round((departureTime * 1000 - now) / 60000);
	return minutes <= 0 ? 'Due' : `${minutes} min`;
}

// Mixed format: countdown for <30 min, clock time for ≥30 min
export function formatDepartureTime(departureTime: number, now: number, timeFormat: 'HH:mm' | 'hh:mm A'): string {
	const minutes = Math.round((departureTime * 1000 - now) / 60000);
	if (minutes <= 0) return 'Due';
	if (minutes < 30) return `${minutes} min`;
	const date = new Date(departureTime * 1000);
	if (timeFormat === 'hh:mm A') {
		return date.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' });
	}
	return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
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
