<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { config } from '$lib/stores/config';
	import { findNearbyRoutes } from '$lib/services/nearby';
	import { fetchStopDepartures } from '$lib/services/stops';
	import { shouldShowDeparture } from '$lib/utils/departureFilters';
	import DepartureRow from './DepartureRow.svelte';
	import AlertTicker from './AlertTicker.svelte';
	import PlatformBoard from './PlatformBoard.svelte';
	import type { Route, Itinerary, Alert } from '$lib/services/nearby';
	import type { TickerAlert } from './AlertTicker.svelte';
	import type { DirectionEntry } from '$lib/utils/displayTypes';

	let departures = $state<DirectionEntry[]>([]);
	let allRoutes = $state<Route[]>([]);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let retryCountdown = $state<number | null>(null);
	let errorType = $state<'rate-limit' | 'auth' | 'timeout' | 'generic' | null>(null);

	function isAlertActive(alert: Alert): boolean {
		if (!alert.active_periods?.length) return true;
		const now = Date.now();
		return alert.active_periods.some(
			(p) =>
				(p.start == null || now >= p.start * 1000) &&
				(p.end == null || now <= p.end * 1000)
		);
	}

	let tickerAlerts = $derived.by((): TickerAlert[] => {
		const seen = new SvelteSet<string>();
		const result: TickerAlert[] = [];
		for (const route of allRoutes) {
			for (const alert of route.alerts ?? []) {
				if (!isAlertActive(alert)) continue;
				const key = `${alert.effect}|${alert.description}`;
				if (seen.has(key)) continue;
				seen.add(key);
				result.push({
					alert,
					routeLabel: route.route_short_name || route.route_long_name?.split(' ')[0] || ''
				});
			}
		}
		return result;
	});

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

			allRoutes = routes;
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
	{#if $config.displayMode === 'platform'}
		<PlatformBoard
			{departures}
			{loading}
			{errorMessage}
			{retryCountdown}
			{tickerAlerts}
		/>
	{:else}
		<div class="table-area">
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
		<AlertTicker alerts={tickerAlerts} />
	{/if}
</div>

<style>
	.board {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.table-area {
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
		padding: 12px var(--row-padding-h);
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
		padding-right: var(--row-padding-h);
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
