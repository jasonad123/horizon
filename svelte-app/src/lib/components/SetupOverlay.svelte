<script lang="ts">
	import { browser } from '$app/environment';
	import { SvelteSet } from 'svelte/reactivity';
	import { config, type FilterMode } from '$lib/stores/config';
	import { findNearbyRoutes, type Route } from '$lib/services/nearby';
	import { findNearbyStops, type Stop } from '$lib/services/stops';
	import RouteIcon from './RouteIcon.svelte';

	let {
		oncomplete,
		oncancel
	}: { oncomplete: () => void; oncancel?: () => void } = $props();

	// ── Step 1: location ─────────────────────────────────────────────
	let step = $state(1);
	let draftCoords = $state('');
	let geoLoading = $state(false);
	let geoError = $state('');

	// Accepts "lat, lon", "lat lon", or "lat,lon"
	function parseCoords(input: string): { lat: number; lon: number } | null {
		const parts = input.trim().split(/[\s,]+/).filter(Boolean);
		if (parts.length < 2) return null;
		const lat = parseFloat(parts[0]);
		const lon = parseFloat(parts[parts.length - 1]);
		if (isNaN(lat) || isNaN(lon)) return null;
		if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
		return { lat, lon };
	}

	let parsedCoords = $derived(parseCoords(draftCoords));
	let locationValid = $derived(parsedCoords !== null);

	async function useMyLocation() {
		if (!browser || !navigator.geolocation) {
			geoError = 'Geolocation not supported by this browser.';
			return;
		}
		geoLoading = true;
		geoError = '';
		try {
			const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
				navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
			);
			draftCoords = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
		} catch {
			geoError = 'Could not get location. Enter coordinates manually.';
		} finally {
			geoLoading = false;
		}
	}

	// ── Step 2: what to show ─────────────────────────────────────────
	let filterMode = $state<FilterMode>('all');
	let selectedRouteIds = new SvelteSet<string>();
	let selectedStopIds = new SvelteSet<string>();

	let nearbyRoutes = $state<Route[]>([]);
	let nearbyStops = $state<Stop[]>([]);
	let pickerLoading = $state(false);
	let pickerError = $state('');

	async function loadRoutes() {
		if (nearbyRoutes.length > 0 || pickerLoading) return;
		pickerLoading = true;
		pickerError = '';
		try {
			const c = parseCoords(draftCoords)!;
			nearbyRoutes = await findNearbyRoutes({ latitude: c.lat, longitude: c.lon }, 1000);
		} catch {
			pickerError = 'Could not load nearby routes.';
		} finally {
			pickerLoading = false;
		}
	}

	async function loadStops() {
		if (nearbyStops.length > 0 || pickerLoading) return;
		pickerLoading = true;
		pickerError = '';
		try {
			const c = parseCoords(draftCoords)!;
			nearbyStops = await findNearbyStops(c.lat, c.lon, 1000);
		} catch {
			pickerError = 'Could not load nearby stops.';
		} finally {
			pickerLoading = false;
		}
	}

	function setFilterMode(mode: FilterMode) {
		filterMode = mode;
		pickerError = '';
		if (mode === 'routes') loadRoutes();
		if (mode === 'stops') loadStops();
	}

	function toggleRoute(id: string) {
		selectedRouteIds.has(id) ? selectedRouteIds.delete(id) : selectedRouteIds.add(id);
	}

	function toggleStop(id: string) {
		selectedStopIds.has(id) ? selectedStopIds.delete(id) : selectedStopIds.add(id);
	}

	// ── Step 3: display settings ──────────────────────────────────────
	let draftTitle = $state('Horizon');
	let draftTimeFormat = $state<'HH:mm' | 'hh:mm A'>('HH:mm');
	let draftMaxDepartures = $state(8);
	let draftUseRouteIcons = $state(true);

	// ── Navigation ───────────────────────────────────────────────────
	function goStep2() {
		step = 2;
		if (filterMode === 'routes') loadRoutes();
		if (filterMode === 'stops') loadStops();
	}

	function save() {
		const c = parseCoords(draftCoords)!;
		config.save({
			title: draftTitle.trim() || 'Horizon',
			location: { latitude: c.lat, longitude: c.lon },
			maxDistance: 1000,
			filterMode,
			selectedStopIds: filterMode === 'stops' ? [...selectedStopIds] : [],
			selectedRouteIds: filterMode === 'routes' ? [...selectedRouteIds] : [],
			timeFormat: draftTimeFormat,
			maxDepartures: Math.max(1, Math.min(30, draftMaxDepartures)),
			useRouteIcons: draftUseRouteIcons
		});
		oncomplete();
	}

	// ── Mode label ───────────────────────────────────────────────────
	function modeLabel(routeType: number | undefined): string {
		switch (routeType) {
			case 0: return 'Tram';
			case 1: return 'Subway';
			case 2: return 'Rail';
			case 3: return 'Bus';
			case 4: return 'Ferry';
			default: return 'Transit';
		}
	}
</script>

<div class="setup-screen">
	<header class="setup-header">
		<span class="setup-title">HORIZON SETUP</span>
		<span class="step-indicator">
			{#each [1, 2, 3] as n (n)}
				<span class="step-dot" class:active={step === n} class:done={step > n}>{n}</span>
				{#if n < 3}<span class="step-line" class:done={step > n}></span>{/if}
			{/each}
		</span>
	</header>

	<div class="setup-body">

		<!-- ── Step 1: Location ────────────────────────────────────── -->
		{#if step === 1}
			<div class="step-content">
				<h2 class="step-heading">DISPLAY LOCATION</h2>
				<p class="step-desc">Set the physical location of this display.</p>

				<button class="geo-btn" onclick={useMyLocation} disabled={geoLoading}>
					<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
						<path d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5m.5-9a.5.5 0 0 0-1 0v1.525A5 5 0 0 0 3.025 7.5H1.5a.5.5 0 0 0 0 1h1.525A5 5 0 0 0 7.5 12.976V14.5a.5.5 0 0 0 1 0v-1.524A5 5 0 0 0 12.975 8.5H14.5a.5.5 0 1 0 0-1h-1.525A5 5 0 0 0 8.5 3.025z"/>
					</svg>
					{geoLoading ? 'Locating...' : 'Use device location'}
				</button>

				{#if geoError}<p class="field-error">{geoError}</p>{/if}

				<label class="field">
					<span>Coordinates</span>
					<input
						type="text"
						inputmode="decimal"
						placeholder="40.748817, -73.985428"
						bind:value={draftCoords}
					/>
				</label>
			</div>
		{/if}

		<!-- ── Step 2: What to show ────────────────────────────────── -->
		{#if step === 2}
			<div class="step-content">
				<h2 class="step-heading">WHAT TO SHOW</h2>
				<p class="step-desc">Choose how this display selects departures.</p>

				<div class="mode-buttons">
					<button
						class="mode-btn"
						class:active={filterMode === 'all'}
						onclick={() => setFilterMode('all')}
					>
						<span class="mode-label">All nearby</span>
						<span class="mode-sub">Every route within range</span>
					</button>
					<button
						class="mode-btn"
						class:active={filterMode === 'routes'}
						onclick={() => setFilterMode('routes')}
					>
						<span class="mode-label">By route</span>
						<span class="mode-sub">Only selected routes</span>
					</button>
					<button
						class="mode-btn"
						class:active={filterMode === 'stops'}
						onclick={() => setFilterMode('stops')}
					>
						<span class="mode-label">By stop</span>
						<span class="mode-sub">Specific bays or platforms</span>
					</button>
				</div>

				<!-- Route picker -->
				{#if filterMode === 'routes'}
					<div class="picker">
						{#if pickerLoading}
							<p class="picker-status">Loading nearby routes...</p>
						{:else if pickerError}
							<p class="picker-status error">{pickerError}</p>
						{:else if nearbyRoutes.length === 0}
							<p class="picker-status">No routes found nearby.</p>
						{:else}
							<p class="picker-hint">
								{selectedRouteIds.size > 0
									? `${selectedRouteIds.size} route${selectedRouteIds.size === 1 ? '' : 's'} selected`
									: 'Select routes to display. Leave empty to show all.'}
							</p>
							<ul class="pick-list">
								{#each nearbyRoutes as route (route.global_route_id)}
									<li class="pick-item" class:selected={selectedRouteIds.has(route.global_route_id)}>
										<label class="pick-label">
											<input
												type="checkbox"
												class="pick-checkbox"
												checked={selectedRouteIds.has(route.global_route_id)}
												onchange={() => toggleRoute(route.global_route_id)}
											/>
											<span class="pick-check" aria-hidden="true">
												{selectedRouteIds.has(route.global_route_id) ? '✓' : ''}
											</span>
											<RouteIcon {route} />
											<span class="pick-name">
												<span class="pick-primary">{route.route_long_name || route.route_short_name}</span>
												{#if route.route_network_name}
													<span class="pick-meta">{route.route_network_name}</span>
												{/if}
											</span>
										</label>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}

				<!-- Stop picker -->
				{#if filterMode === 'stops'}
					<div class="picker">
						{#if pickerLoading}
							<p class="picker-status">Loading nearby stops...</p>
						{:else if pickerError}
							<p class="picker-status error">{pickerError}</p>
						{:else if nearbyStops.length === 0}
							<p class="picker-status">No stops found nearby.</p>
						{:else}
							<p class="picker-hint">
								{selectedStopIds.size > 0
									? `${selectedStopIds.size} stop${selectedStopIds.size === 1 ? '' : 's'} selected`
									: 'Select the stops or bays to display.'}
							</p>
							<ul class="pick-list">
								{#each nearbyStops as stop (stop.global_stop_id)}
									<li class="pick-item" class:selected={selectedStopIds.has(stop.global_stop_id)}>
										<label class="pick-label">
											<input
												type="checkbox"
												class="pick-checkbox"
												checked={selectedStopIds.has(stop.global_stop_id)}
												onchange={() => toggleStop(stop.global_stop_id)}
											/>
											<span class="pick-check" aria-hidden="true">
												{selectedStopIds.has(stop.global_stop_id) ? '✓' : ''}
											</span>
											<span class="stop-code-badge">
												{stop.stop_code || modeLabel(stop.route_type)}
											</span>
											<span class="pick-name">
												<span class="pick-primary">{stop.stop_name}</span>
												{#if stop.distance != null}
													<span class="pick-meta">{Math.round(stop.distance)}m</span>
												{/if}
											</span>
										</label>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- ── Step 3: Display settings ───────────────────────────── -->
		{#if step === 3}
			<div class="step-content">
				<h2 class="step-heading">DISPLAY SETTINGS</h2>
				<p class="step-desc">Configure how this display appears.</p>

				<div class="settings-fields">
					<label class="field">
						<span>Display name</span>
						<input type="text" placeholder="e.g. Central Terminal" bind:value={draftTitle} />
					</label>

					<fieldset class="field field-radio">
						<legend>Time format</legend>
						<label class="radio-option">
							<input type="radio" name="tf" value="HH:mm" bind:group={draftTimeFormat} />
							24-hour (14:35)
						</label>
						<label class="radio-option">
							<input type="radio" name="tf" value="hh:mm A" bind:group={draftTimeFormat} />
							12-hour (2:35 PM)
						</label>
					</fieldset>

					<label class="field field-narrow">
						<span>Max rows</span>
						<input type="number" min="1" max="30" bind:value={draftMaxDepartures} />
					</label>

					<fieldset class="field field-radio">
						<legend>Route badge style</legend>
						<label class="radio-option">
							<input type="radio" name="icons" value={true} bind:group={draftUseRouteIcons} />
							Icons when available
						</label>
						<label class="radio-option">
							<input type="radio" name="icons" value={false} bind:group={draftUseRouteIcons} />
							Text only
						</label>
					</fieldset>
				</div>
			</div>
		{/if}
	</div>

	<!-- Footer nav -->
	<footer class="setup-footer">
		{#if step > 1}
			<button class="btn-back" onclick={() => (step -= 1)}>Back</button>
		{:else if oncancel}
			<button class="btn-back" onclick={oncancel}>Cancel</button>
		{:else}
			<span></span>
		{/if}

		{#if step === 1}
			<button class="btn-continue" onclick={goStep2} disabled={!locationValid}>
				Continue
			</button>
		{:else if step === 2}
			<button class="btn-continue" onclick={() => (step = 3)}>
				Continue
			</button>
		{:else}
			<button class="btn-continue" onclick={save}>
				Save &amp; Start
			</button>
		{/if}
	</footer>
</div>

<style>
	.setup-screen {
		position: fixed;
		inset: 0;
		background: var(--bg-primary);
		display: flex;
		flex-direction: column;
		z-index: 100;
	}

	/* ── Header ─────────────────────────────────────────────────── */
	.setup-header {
		height: var(--header-height);
		background: var(--bg-header);
		border-bottom: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px;
		flex-shrink: 0;
	}

	.setup-title {
		font-size: 1em;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--text-secondary);
	}

	.step-indicator {
		display: flex;
		align-items: center;
		gap: 0;
	}

	.step-dot {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid var(--border-color);
		color: var(--text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75em;
		font-weight: 700;
		transition: all 0.2s;
	}

	.step-dot.active {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	.step-dot.done {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: #fff;
	}

	.step-line {
		width: 32px;
		height: 2px;
		background: var(--border-color);
		transition: background 0.2s;
	}

	.step-line.done {
		background: var(--color-accent);
	}

	/* ── Body ───────────────────────────────────────────────────── */
	.setup-body {
		flex: 1;
		overflow-y: auto;
		display: flex;
		justify-content: center;
		padding: 40px 24px;
	}

	.step-content {
		width: 100%;
		max-width: clamp(480px, 55vw, 800px);
	}

	.step-heading {
		font-size: 0.75em;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--text-secondary);
		margin-bottom: 6px;
	}

	.step-desc {
		font-size: 1em;
		color: var(--text-primary);
		margin-bottom: 28px;
	}

	/* ── Step 1: geo + coords ───────────────────────────────────── */
	.geo-btn {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 20px;
		background: rgba(58, 123, 213, 0.12);
		border: 1px solid var(--color-accent);
		border-radius: 6px;
		color: var(--color-accent);
		font-size: 1em;
		font-weight: 600;
		cursor: pointer;
		margin-bottom: 24px;
		transition: background 0.15s;
	}

	.geo-btn:hover:not(:disabled) {
		background: rgba(58, 123, 213, 0.2);
	}

	.geo-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.geo-btn svg {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.field-error {
		font-size: 0.85em;
		color: var(--color-cancelled);
		margin: -16px 0 20px;
	}

	/* ── Step 2: mode buttons ───────────────────────────────────── */
	.mode-buttons {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
		margin-bottom: 28px;
	}

	.mode-btn {
		padding: clamp(20px, 2.5vh, 32px) clamp(16px, 2vw, 28px);
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		color: var(--text-secondary);
		cursor: pointer;
		text-align: left;
		transition: all 0.15s;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.mode-btn:hover {
		border-color: var(--text-muted);
		color: var(--text-primary);
	}

	.mode-btn.active {
		border-color: var(--color-accent);
		border-width: 2px;
		background: rgba(58, 123, 213, 0.1);
		color: var(--text-primary);
	}

	.mode-label {
		font-size: 2em;
		font-weight: 700;
	}

	.mode-sub {
		font-size: 1.25em;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.mode-btn.active .mode-sub {
		color: var(--text-secondary);
	}


	/* ── Picker (route + stop lists) ────────────────────────────── */
	.picker {
		border: 1px solid var(--border-color);
		border-radius: 6px;
		overflow: hidden;
	}

	.picker-status {
		padding: 20px;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.9em;
	}

	.picker-status.error {
		color: var(--color-cancelled);
	}

	.picker-hint {
		padding: 10px 16px;
		font-size: 0.82em;
		color: var(--text-secondary);
		border-bottom: 1px solid var(--border-color);
		background: rgba(255, 255, 255, 0.02);
	}

	.pick-list {
		list-style: none;
		max-height: 340px;
		overflow-y: auto;
	}

	.pick-checkbox {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
		pointer-events: none;
	}

	.pick-label {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		cursor: pointer;
	}

	.pick-item {
		display: flex;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-color);
		cursor: pointer;
		transition: background 0.1s;
		user-select: none;
	}

	.pick-item:last-child {
		border-bottom: none;
	}

	.pick-item:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.pick-item.selected {
		background: rgba(58, 123, 213, 0.08);
	}

	.pick-check {
		width: 20px;
		height: 20px;
		border: 1.5px solid var(--border-color);
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75em;
		font-weight: 700;
		flex-shrink: 0;
		color: var(--color-accent);
		transition: all 0.1s;
	}

	.pick-item.selected .pick-check {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: #fff;
	}

	.pick-name {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.pick-primary {
		font-size: 0.95em;
		font-weight: 500;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pick-meta {
		font-size: 0.78em;
		color: var(--text-muted);
	}

	.stop-code-badge {
		flex-shrink: 0;
		font-size: 0.75em;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-secondary);
		white-space: nowrap;
	}

	/* ── Step 3: settings ───────────────────────────────────────── */
	.settings-fields {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	/* ── Shared field styles ────────────────────────────────────── */
	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.field > span,
	.field > legend {
		font-size: 0.78em;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
		text-transform: uppercase;
		border: none;
		padding: 0;
	}

	.field input[type='text'],
	.field input[type='number'] {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 1em;
		font-family: inherit;
		padding: 11px 14px;
		transition: border-color 0.15s;
	}

	.field input:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.field-narrow input {
		max-width: 120px;
	}

	.field-radio {
		border: none;
		padding: 0;
		margin: 0;
	}

	.radio-option {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 0;
		font-size: 0.95em;
		color: var(--text-primary);
		cursor: pointer;
	}

	.radio-option input[type='radio'] {
		accent-color: var(--color-accent);
		width: 16px;
		height: 16px;
		cursor: pointer;
	}

	/* ── Footer ─────────────────────────────────────────────────── */
	.setup-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px;
		border-top: 1px solid var(--border-color);
		background: var(--bg-header);
		flex-shrink: 0;
	}

	.btn-back {
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: 5px;
		color: var(--text-secondary);
		font-size: 0.95em;
		font-family: inherit;
		padding: 10px 24px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-back:hover {
		border-color: var(--text-muted);
		color: var(--text-primary);
	}

	.btn-continue {
		background: var(--color-accent);
		border: 1px solid transparent;
		border-radius: 5px;
		color: #fff;
		font-size: 0.95em;
		font-weight: 600;
		font-family: inherit;
		padding: 10px 28px;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.btn-continue:hover:not(:disabled) {
		opacity: 0.88;
	}

	.btn-continue:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
</style>
