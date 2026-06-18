<script lang="ts">
	import RouteIcon from './RouteIcon.svelte';
	import AlertTicker from './AlertTicker.svelte';
	import 'iconify-icon';
	import { formatCountdown, formatDepartureTime } from '$lib/utils/timeUtils';
	import { shouldShowDeparture } from '$lib/utils/departureFilters';
	import { config } from '$lib/stores/config';
	import type { DirectionEntry } from '$lib/utils/displayTypes';
	import type { ScheduleItem } from '$lib/services/nearby';
	import type { TickerAlert } from './AlertTicker.svelte';

	let {
		departures,
		loading,
		errorMessage,
		retryCountdown,
		tickerAlerts
	}: {
		departures: DirectionEntry[];
		loading: boolean;
		errorMessage: string | null;
		retryCountdown: number | null;
		tickerAlerts: TickerAlert[];
	} = $props();

	let now = $state(Date.now());
	let selectedIndex = $state(0);

	$effect(() => {
		const id = setInterval(() => { now = Date.now(); }, 1000);
		return () => clearInterval(id);
	});

	// Reset selection when departures list changes shape (e.g. after a poll)
	$effect(() => {
		if (departures.length > 0 && selectedIndex >= departures.length) {
			selectedIndex = 0;
		}
	});

	const RT_ICONS = ['tabler:wifi-0', 'tabler:wifi-1', 'tabler:wifi-2', 'tabler:wifi'];
	let rtIconIndex = $state(0);

	$effect(() => {
		const entry = departures[selectedIndex];
		const hasRt = visibleItems(entry).some((i) => i.is_real_time);
		if (!hasRt) return;
		const id = setInterval(() => { rtIconIndex = (rtIconIndex + 1) % RT_ICONS.length; }, 800);
		return () => clearInterval(id);
	});

	let rtIcon = $derived(RT_ICONS[rtIconIndex]);

	function visibleItems(entry: DirectionEntry | undefined): ScheduleItem[] {
		if (!entry) return [];
		return (entry.itinerary.schedule_items ?? [])
			.filter((item) => shouldShowDeparture(item.departure_time, now))
			.sort((a, b) => a.departure_time - b.departure_time);
	}

	function stopLabelFor(entry: DirectionEntry): string {
		const stop = entry.itinerary.closest_stop;
		if (!stop) return '';
		const rawCode = stop.stop_code ?? '';
		const code = rawCode && !/^\d{7,}$/.test(rawCode) ? rawCode : null;
		if (stop.parent_station) {
			if (code) return code;
			const stationName = stop.parent_station.station_name ?? '';
			const stopName = stop.stop_name ?? '';
			if (stationName && stopName.startsWith(stationName)) {
				const sub = stopName.slice(stationName.length).replace(/^[\s\-–/]+/, '').trim();
				if (sub) return sub;
			}
			return stationName || stopName;
		}
		return code ?? stop.stop_name ?? '';
	}

	function destinationFor(entry: DirectionEntry): string {
		return entry.itinerary.merged_headsign || entry.itinerary.direction_headsign || entry.itinerary.headsign || '';
	}

	let active = $derived(departures[selectedIndex]);
	let activeItems = $derived(visibleItems(active));
	let featuredItem = $derived(activeItems[0]);
	let subsequentItems = $derived(activeItems.slice(1));
	let featuredCountdown = $derived(featuredItem ? formatDepartureTime(featuredItem.departure_time, now, $config.timeFormat) : '');
	let featuredStopLabel = $derived(active ? stopLabelFor(active) : '');
	let featuredDestination = $derived(active ? destinationFor(active) : '');
	let featuredHasAlert = $derived((active?.route.alerts?.length ?? 0) > 0);
	let hasMultiple = $derived(departures.length > 1);

	function prev() {
		selectedIndex = (selectedIndex - 1 + departures.length) % departures.length;
	}

	function next() {
		selectedIndex = (selectedIndex + 1) % departures.length;
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}
</script>

<svelte:window onkeydown={handleKey} />

<div class="platform-board">
	<div class="content-area">
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
		{:else if departures.length === 0 || !featuredItem}
			<div class="overlay">
				<span class="overlay-text">No departures scheduled</span>
			</div>
		{:else}
			<!-- Direction selector (only shown when multiple directions available) -->
			{#if hasMultiple}
				<div class="direction-bar">
					<button class="dir-btn" onclick={prev} aria-label="Previous direction">
						<iconify-icon icon="tabler:chevron-left"></iconify-icon>
					</button>
					<div class="direction-info">
						<span class="direction-label">
							<RouteIcon route={active.route} useIcons={$config.useRouteIcons} />
							<span class="direction-destination">{featuredDestination}</span>
						</span>
						<span class="direction-counter">{selectedIndex + 1} / {departures.length}</span>
					</div>
					<button class="dir-btn" onclick={next} aria-label="Next direction">
						<iconify-icon icon="tabler:chevron-right"></iconify-icon>
					</button>
				</div>
			{:else}
				<div class="next-label">NEXT DEPARTURE</div>
			{/if}

			<!-- Featured next departure -->
			<div class="featured-card" class:is-cancelled={featuredItem.is_cancelled}>
				{#if !hasMultiple}
					<div class="featured-route">
						<RouteIcon route={active.route} useIcons={$config.useRouteIcons} />
					</div>
					<div class="featured-info">
						<div class="featured-destination" class:cancelled-text={featuredItem.is_cancelled}>
							{#if featuredHasAlert}
								<iconify-icon class="alert-icon" icon="tabler:alert-triangle" aria-label="Service alert"></iconify-icon>
							{/if}
							{featuredDestination}
						</div>
						{#if featuredStopLabel}
							<div class="featured-stop">{featuredStopLabel}</div>
						{/if}
					</div>
				{:else}
					<!-- When direction bar is shown, featured card is more compact -->
					<div class="featured-info-wide">
						{#if featuredStopLabel}
							<div class="featured-stop">{featuredStopLabel}</div>
						{/if}
						{#if featuredHasAlert}
							<iconify-icon class="alert-icon" icon="tabler:alert-triangle" aria-label="Service alert"></iconify-icon>
						{/if}
					</div>
				{/if}
				<div class="featured-time">
					<span class="featured-countdown" class:cancelled-text={featuredItem.is_cancelled}>
						{featuredItem.is_cancelled ? 'Cancelled' : featuredCountdown}
					</span>
					{#if !featuredItem.is_cancelled}
						{#if featuredItem.is_real_time}
							<iconify-icon class="status-icon rt" icon={rtIcon} aria-label="Real time"></iconify-icon>
						{:else}
							<iconify-icon class="status-icon sch" icon="tabler:clock" aria-label="Scheduled"></iconify-icon>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Subsequent departures — same direction/itinerary only -->
			{#if subsequentItems.length > 0}
				<div class="subsequent-list">
					{#each subsequentItems as item, i (item.departure_time)}
						<div class="sub-row"
							class:alt={($config.rowStyle ?? 'alternating') === 'alternating' && i % 2 !== 0}
							class:card={($config.rowStyle ?? 'alternating') === 'card'}
							class:is-cancelled={item.is_cancelled}
						>
							<div class="sub-index">{i + 2}</div>
							<div class="sub-time-block">
								<span class="sub-countdown" class:cancelled-text={item.is_cancelled}>
									{item.is_cancelled ? 'Cancelled' : formatDepartureTime(item.departure_time, now, $config.timeFormat)}
								</span>
								{#if !item.is_cancelled}
									{#if item.is_real_time}
										<iconify-icon class="status-icon-sm rt" icon={rtIcon} aria-label="Real time"></iconify-icon>
									{:else}
										<iconify-icon class="status-icon-sm sch" icon="tabler:clock" aria-label="Scheduled"></iconify-icon>
									{/if}
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
	<AlertTicker alerts={tickerAlerts} />
</div>

<style>
	.platform-board {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.content-area {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		padding: clamp(16px, 2vh, 28px) clamp(20px, 2.5vw, 40px);
		gap: clamp(12px, 1.5vh, 20px);
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

	/* "NEXT DEPARTURE" label (single-direction case) */
	.next-label {
		font-size: 0.68em;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	/* Direction selector bar */
	.direction-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--bg-header);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: clamp(10px, 1.2vh, 16px) clamp(12px, 1.2vw, 18px);
		flex-shrink: 0;
	}

	.dir-btn {
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 6px 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1em;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.dir-btn:hover {
		border-color: var(--text-muted);
		color: var(--text-primary);
	}

	.direction-info {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		gap: 12px;
	}

	.direction-label {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.direction-destination {
		font-size: 1.1em;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.direction-counter {
		font-size: 0.75em;
		color: var(--text-muted);
		font-weight: 600;
		letter-spacing: 0.06em;
		flex-shrink: 0;
	}

	/* Featured card */
	.featured-card {
		display: flex;
		align-items: center;
		gap: clamp(14px, 1.5vw, 24px);
		background: var(--bg-header);
		border: 1px solid var(--border-group-sep);
		border-left: 3px solid var(--color-accent);
		border-radius: 6px;
		padding: clamp(16px, 2vh, 24px) clamp(18px, 2vw, 28px);
		flex-shrink: 0;
	}

	.featured-card.is-cancelled {
		opacity: 0.5;
		border-left-color: var(--color-cancelled);
	}

	.featured-route {
		flex-shrink: 0;
	}

	.featured-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.featured-info-wide {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.featured-destination {
		font-size: 1.3em;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.featured-stop {
		font-size: 0.82em;
		color: var(--text-secondary);
		letter-spacing: 0.02em;
	}

	.featured-time {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	.featured-countdown {
		font-size: clamp(1.6em, 3.5vw, 2.2em);
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}

	/* Subsequent departures — same direction only */
	.subsequent-list {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--border-color);
	}

	.sub-row {
		display: flex;
		align-items: center;
		gap: clamp(12px, 1.2vw, 20px);
		height: clamp(56px, 6.5vh, 76px);
		padding: 0 clamp(12px, 1.2vw, 18px);
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.sub-row.alt {
		background: var(--bg-row-alt);
	}

	.sub-row.card {
		background: var(--bg-row-card);
	}

	.sub-row.is-cancelled {
		opacity: 0.5;
	}

	/* Ordinal counter: 2, 3, 4… */
	.sub-index {
		flex-shrink: 0;
		width: 1.8em;
		font-size: 0.82em;
		font-weight: 700;
		color: var(--text-muted);
		text-align: right;
	}

	.sub-time-block {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.sub-countdown {
		font-size: 1.15em;
		font-weight: 700;
		color: var(--text-primary);
		min-width: 70px;
	}

	.cancelled-text {
		text-decoration: line-through;
		color: var(--color-cancelled);
	}

	/* Status icons for featured card */
	.status-icon {
		font-size: clamp(24px, 2.2vw, 36px);
		flex-shrink: 0;
		display: block;
	}

	.status-icon.rt {
		color: var(--color-realtime);
		transform: rotate(45deg);
	}

	.status-icon.sch {
		color: var(--color-scheduled);
		opacity: 0.7;
	}

	/* Status icons for subsequent rows */
	.status-icon-sm {
		font-size: clamp(20px, 1.8vw, 28px);
		flex-shrink: 0;
		display: block;
	}

	.status-icon-sm.rt {
		color: var(--color-realtime);
		transform: rotate(45deg);
	}

	.status-icon-sm.sch {
		color: var(--color-scheduled);
		opacity: 0.7;
	}

	.alert-icon {
		display: inline-block;
		vertical-align: middle;
		font-size: 1.1em;
		color: var(--color-alert);
		margin-right: 8px;
	}
</style>
