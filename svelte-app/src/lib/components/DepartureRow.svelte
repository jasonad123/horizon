<script lang="ts">
	import RouteIcon from './RouteIcon.svelte';
	import { formatCountdown } from '$lib/utils/timeUtils';
	import { shouldShowDeparture } from '$lib/utils/departureFilters';
	import { config } from '$lib/stores/config';
	import type { Route, Itinerary, ScheduleItem } from '$lib/services/nearby';

	let {
		route,
		itinerary,
		showBadge = true,
		groupIndex = 0
	}: {
		route: Route;
		itinerary: Itinerary;
		showBadge?: boolean;
		groupIndex?: number;
	} = $props();

	let now = $state(Date.now());

	$effect(() => {
		const id = setInterval(() => { now = Date.now(); }, 1000);
		return () => clearInterval(id);
	});

	let currentItem = $derived.by((): ScheduleItem | undefined =>
		(itinerary.schedule_items ?? [])
			.filter((item) => shouldShowDeparture(item.departure_time, now))
			.sort((a, b) => a.departure_time - b.departure_time)[0]
	);

	let countdown = $derived(currentItem ? formatCountdown(currentItem.departure_time, now) : '');

	let stopLabel = $derived.by(() => {
		const stop = itinerary.closest_stop;
		if (!stop) return '';

		const rawCode = stop.stop_code ?? '';
		// 7+ digit pure-numeric strings are internal GTFS stop_ids, not passenger labels
		const code = rawCode && !/^\d{7,}$/.test(rawCode) ? rawCode : null;

		if (stop.parent_station) {
			// Stop is part of a larger station (terminal, interchange, etc.).
			// Prefer the stop-specific identifier; fall back to the parent station name.
			if (code) return code;

			// Strip the parent station name prefix from stop_name to get the sub-identifier.
			// e.g. stop_name "Union Station - Gate A", station_name "Union Station" → "Gate A"
			const stationName = stop.parent_station.station_name ?? '';
			const stopName = stop.stop_name ?? '';
			if (stationName && stopName.startsWith(stationName)) {
				const sub = stopName.slice(stationName.length).replace(/^[\s\-–/]+/, '').trim();
				if (sub) return sub;
			}

			// Nothing more specific — show the parent station name itself
			return stationName || stopName;
		}

		// No parent station: show stop_code or full stop_name, let CSS clip if needed
		return code ?? stop.stop_name ?? '';
	});

	let destination = $derived(
		itinerary.merged_headsign || itinerary.direction_headsign || itinerary.headsign || ''
	);

	let hasAlert = $derived((route.alerts?.length ?? 0) > 0);
	let isAlt = $derived(groupIndex % 2 !== 0);
</script>

{#if currentItem}
	<tr class="departure-row" class:alt={isAlt} class:is-cancelled={currentItem.is_cancelled}>
		<td class="col-route">
			{#if showBadge}
				<RouteIcon {route} useIcons={$config.useRouteIcons} />
			{/if}
		</td>
		<td class="col-destination" class:cancelled-text={currentItem.is_cancelled}>
			{#if hasAlert}
				<svg class="alert-icon" viewBox="0 0 16 16" fill="none" aria-label="Service alert">
					<path d="M8 2L14.5 13H1.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
					<path d="M8 6.5v3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
					<circle cx="8" cy="11.75" r="0.75" fill="currentColor"/>
				</svg>
			{/if}
			{#if !showBadge}<span class="direction-indent"></span>{/if}
			{destination}
		</td>
		<td class="col-stop">
			{stopLabel}
		</td>
		<td class="col-time">
			<div class="time-inner">
				<span class="countdown" class:cancelled-text={currentItem.is_cancelled}>
					{currentItem.is_cancelled ? 'Cancelled' : countdown}
				</span>
				{#if !currentItem.is_cancelled}
					{#if currentItem.is_real_time}
						<svg class="status-icon rt" viewBox="0 0 16 16" fill="none" aria-label="Real time">
							<title>Real time</title>
							<circle cx="8" cy="11.5" r="2" fill="currentColor"/>
							<path d="M4.5 7.5a5 5 0 0 1 7 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							<path d="M1.5 4.5a9.5 9.5 0 0 1 13 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
					{:else}
						<svg class="status-icon sch" viewBox="0 0 16 16" fill="none" aria-label="Scheduled">
							<title>Scheduled</title>
							<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
							<path d="M8 4.5V8l2.5 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					{/if}
				{/if}
			</div>
		</td>
	</tr>
{/if}

<style>
	.departure-row {
		height: var(--row-height);
		border-bottom: 1px solid var(--border-color);
	}

	/* Alternate shading per route group, not per individual row */
	.departure-row.alt {
		background: var(--bg-row-alt);
	}

.departure-row.is-cancelled {
		opacity: 0.5;
	}

	td {
		padding: 0 14px;
		vertical-align: middle;
		white-space: nowrap;
		overflow: hidden;
	}

	.col-route {
		width: var(--col-route);
		padding: 0 10px;
		text-align: center;
	}

	.col-destination {
		max-width: 0;
		width: 100%;
		font-size: 1.1em;
		font-weight: 500;
		color: var(--text-primary);
		text-overflow: ellipsis;
	}

	.direction-indent {
		display: inline-block;
		vertical-align: middle;
		width: 2px;
		height: 1.1em;
		background: var(--border-color);
		border-radius: 1px;
		margin-right: 10px;
	}

	.col-stop {
		width: var(--col-stop);
		font-size: 0.88em;
		color: var(--text-secondary);
		text-align: center;
		text-overflow: ellipsis;
	}

	.col-time {
		width: var(--col-time);
	}

	.time-inner {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
		padding-right: 4px;
	}

	.countdown {
		font-size: 1.15em;
		font-weight: 700;
		color: var(--text-primary);
		min-width: 60px;
		text-align: right;
	}

	.cancelled-text {
		text-decoration: line-through;
		color: var(--color-cancelled);
	}

	/* Status icons */
	.status-icon {
		width: clamp(16px, 1.4vw, 22px);
		height: clamp(16px, 1.4vw, 22px);
		flex-shrink: 0;
	}

	.status-icon.rt {
		color: var(--color-realtime);
	}

	.status-icon.sch {
		color: var(--color-scheduled);
		opacity: 0.7;
	}

	/* Alert icon — inline before destination text */
	.alert-icon {
		display: inline-block;
		vertical-align: middle;
		width: clamp(13px, 1.1vw, 17px);
		height: clamp(13px, 1.1vw, 17px);
		color: var(--color-alert);
		margin-right: 7px;
	}
</style>
