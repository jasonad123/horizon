<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { config } from '$lib/stores/config';
	import { findNearbyRoutes } from '$lib/services/nearby';
	import { fetchStopDepartures } from '$lib/services/stops';
	import { shouldShowDeparture } from '$lib/utils/departureFilters';
	import DepartureRow from './DepartureRow.svelte';
	import type { Route, Itinerary } from '$lib/services/nearby';

	interface DirectionEntry {
		route: Route;
		itinerary: Itinerary;
		showBadge: boolean;  // true only for the first direction in each route group
		groupIndex: number;  // increments per route — drives alternating row shading
	}

	let departures = $state<DirectionEntry[]>([]);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let retryCountdown = $state<number | null>(null);
	let errorType = $state<'rate-limit' | 'auth' | 'timeout' | 'generic' | null>(null);

	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let retryTimeout: ReturnType<typeof setTimeout> | null = null;
	let retryCountdownInterval: ReturnType<typeof setInterval> | null = null;

	const POLLING_INTERVAL = parseInt(import.meta.env.VITE_CLIENT_POLLING_INTERVAL || '10000');

	function nextDepartureTime(itinerary: Itinerary): number {
		return (itinerary.schedule_items ?? [])
			.filter((i) => shouldShowDeparture(i.departure_time))
			.sort((a, b) => a.departure_time - b.departure_time)[0]?.departure_time ?? Infinity;
	}

	function buildDirections(routes: Route[]): DirectionEntry[] {
		type Group = { route: Route; itineraries: Itinerary[]; soonest: number };
		const groups: Group[] = [];

		for (const route of routes) {
			const valid = (route.itineraries ?? []).filter((itin) =>
				(itin.schedule_items ?? []).some((i) => shouldShowDeparture(i.departure_time))
			);
			if (valid.length === 0) continue;
			valid.sort((a, b) => nextDepartureTime(a) - nextDepartureTime(b));
			groups.push({ route, itineraries: valid, soonest: nextDepartureTime(valid[0]) });
		}

		groups.sort((a, b) => a.soonest - b.soonest);

		const entries: DirectionEntry[] = [];
		groups.forEach((g, groupIndex) => {
			g.itineraries.forEach((itinerary, i) => {
				entries.push({ route: g.route, itinerary, showBadge: i === 0, groupIndex });
			});
		});
		return entries;
	}

	async function fetchDepartures() {
		const cfg = $config;
		if (!cfg.loaded) return;

		try {
			let routes: Route[];

			if (cfg.filterMode === 'stops' && cfg.selectedStopIds.length > 0) {
				routes = await fetchStopDepartures(cfg.selectedStopIds, Math.min(cfg.maxDepartures, 10));
			} else if (cfg.location) {
				routes = await findNearbyRoutes(cfg.location, cfg.maxDistance);
				if (cfg.filterMode === 'routes' && cfg.selectedRouteIds.length > 0) {
					const allowed = new Set(cfg.selectedRouteIds);
					routes = routes.filter((r) => allowed.has(r.global_route_id));
				}
			} else {
				departures = [];
				loading = false;
				return;
			}

			departures = buildDirections(routes).slice(0, cfg.maxDepartures);
			loading = false;
			errorMessage = null;
			errorType = null;
			retryCountdown = null;
		} catch (err: unknown) {
			loading = false;
			const error = err as Record<string, unknown>;

			if (error.isRateLimit) {
				const retryAfter = (error.retryAfter as number) || 60;
				errorMessage = `Rate limit reached. Retrying in ${retryAfter}s.`;
				errorType = 'rate-limit';
				scheduleRetry(retryAfter);
			} else if (error.isAuthError) {
				errorMessage = 'API authentication error. Check TRANSIT_API_KEY.';
				errorType = 'auth';
			} else if (error.isTimeout) {
				errorMessage = 'Request timed out. Retrying soon.';
				errorType = 'timeout';
				scheduleRetry(15);
			} else {
				errorMessage = 'Unable to load departures.';
				errorType = 'generic';
				scheduleRetry(30);
			}
		}
	}

	function scheduleRetry(seconds: number) {
		clearRetry();
		retryCountdown = seconds;
		retryCountdownInterval = setInterval(() => {
			if (retryCountdown !== null && retryCountdown > 0) {
				retryCountdown -= 1;
			}
		}, 1000);
		retryTimeout = setTimeout(() => {
			clearRetry();
			fetchDepartures();
		}, seconds * 1000);
	}

	function clearRetry() {
		if (retryTimeout) { clearTimeout(retryTimeout); retryTimeout = null; }
		if (retryCountdownInterval) { clearInterval(retryCountdownInterval); retryCountdownInterval = null; }
		retryCountdown = null;
	}

	function startPolling() {
		fetchDepartures();
		pollInterval = setInterval(fetchDepartures, POLLING_INTERVAL);
	}

	function stopPolling() {
		if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
		clearRetry();
	}

	onMount(() => {
		// Wait for config to be loaded before starting polls
		const unsubscribe = config.subscribe((cfg) => {
			if (cfg.loaded && !pollInterval) {
				startPolling();
			}
		});
		return unsubscribe;
	});

	onDestroy(() => stopPolling());
</script>

<div class="board">
	{#if loading}
		<div class="overlay">
			<span class="overlay-text">Loading departures...</span>
		</div>
	{:else if errorMessage && departures.length === 0}
		<div class="overlay overlay-error">
			<span class="overlay-text">{errorMessage}</span>
			{#if retryCountdown !== null && retryCountdown > 0}
				<span class="overlay-sub">Retrying in {retryCountdown}s</span>
			{/if}
		</div>
	{:else if departures.length === 0}
		<div class="overlay">
			<span class="overlay-text">No departures scheduled</span>
		</div>
	{:else}
		<table class="departure-table">
			<thead>
				<tr>
					<th class="col-route">LINE</th>
					<th class="col-destination">DESTINATION</th>
					<th class="col-stop">STOP / BAY</th>
					<th class="col-time">TIME</th>
				</tr>
			</thead>
			<tbody>
				{#each departures as entry (entry.route.global_route_id + '-' + (entry.itinerary.direction_id ?? '') + '-' + (entry.itinerary.merged_headsign || entry.itinerary.headsign || ''))}
					<DepartureRow
						route={entry.route}
						itinerary={entry.itinerary}
						showBadge={entry.showBadge}
						groupIndex={entry.groupIndex}
					/>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.board {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.departure-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}

	thead tr {
		background: var(--bg-header);
		border-bottom: 2px solid var(--border-color);
	}

	thead th {
		padding: 12px 14px;
		font-size: 0.72em;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-secondary);
		text-align: left;
	}

	thead th.col-route {
		width: var(--col-route);
		padding: 12px 10px;
		text-align: center;
	}

	thead th.col-stop {
		width: var(--col-stop);
		text-align: center;
	}

	thead th.col-time {
		width: var(--col-time);
		text-align: right;
	}

	.overlay {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}

	.overlay-text {
		font-size: 1.1em;
		color: var(--text-secondary);
	}

	.overlay-error .overlay-text {
		color: var(--color-cancelled);
	}

	.overlay-sub {
		font-size: 0.85em;
		color: var(--text-muted);
	}
</style>
