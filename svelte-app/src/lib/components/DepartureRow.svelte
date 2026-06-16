<script lang="ts">
	import RouteIcon from './RouteIcon.svelte';
	import { formatCountdown } from '$lib/utils/timeUtils';
	import type { Route, Itinerary, ScheduleItem } from '$lib/services/nearby';

	let {
		route,
		itinerary,
		item
	}: {
		route: Route;
		itinerary: Itinerary;
		item: ScheduleItem;
	} = $props();

	let countdown = $state('');

	$effect(() => {
		countdown = formatCountdown(item.departure_time);
		const id = setInterval(() => {
			countdown = formatCountdown(item.departure_time);
		}, 1000);
		return () => clearInterval(id);
	});

	let stopLabel = $derived.by(() => {
		const stop = itinerary.closest_stop;
		if (!stop) return '';
		if (stop.stop_code) return stop.stop_code;
		const name = stop.stop_name;
		const dashIdx = name.lastIndexOf(' - ');
		if (dashIdx > -1) return name.slice(dashIdx + 3);
		return name;
	});

	let destination = $derived(
		itinerary.merged_headsign || itinerary.direction_headsign || itinerary.headsign || ''
	);
</script>

<tr class="departure-row" class:is-cancelled={item.is_cancelled}>
	<td class="col-route">
		<RouteIcon {route} />
	</td>
	<td class="col-destination" class:cancelled-text={item.is_cancelled}>
		{destination}
	</td>
	<td class="col-stop">
		{stopLabel}
	</td>
	<td class="col-time">
		<div class="time-inner">
			<span class="countdown" class:cancelled-text={item.is_cancelled}>
				{item.is_cancelled ? 'Cancelled' : countdown}
			</span>
			{#if !item.is_cancelled}
				<span class="status-badge" class:rt={item.is_real_time} class:sch={!item.is_real_time}>
					{item.is_real_time ? 'RT' : 'SCH'}
				</span>
			{/if}
		</div>
	</td>
</tr>

<style>
	.departure-row {
		height: var(--row-height);
		border-bottom: 1px solid var(--border-color);
	}

	.departure-row:nth-child(even) {
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
		text-overflow: ellipsis;
	}

	.col-route {
		width: 68px;
		padding: 0 12px;
		text-align: center;
	}

	.col-destination {
		max-width: 0;
		width: 100%;
		font-size: 1.1em;
		font-weight: 500;
		color: var(--text-primary);
	}

	.col-stop {
		width: 140px;
		font-size: 0.9em;
		color: var(--text-secondary);
		text-align: center;
	}

	.col-time {
		width: 150px;
	}

	.time-inner {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}

	.countdown {
		font-size: 1.15em;
		font-weight: 700;
		color: var(--text-primary);
		min-width: 58px;
		text-align: right;
	}

	.cancelled-text {
		text-decoration: line-through;
		color: var(--color-cancelled);
	}

	.status-badge {
		font-size: 0.65em;
		font-weight: 700;
		padding: 3px 5px;
		border-radius: 3px;
		letter-spacing: 0.05em;
	}

	.status-badge.rt {
		background: rgba(76, 222, 128, 0.15);
		color: var(--color-realtime);
	}

	.status-badge.sch {
		background: rgba(200, 168, 64, 0.15);
		color: var(--color-scheduled);
	}
</style>
