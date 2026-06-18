<script lang="ts">
	import type { Alert } from '$lib/services/nearby';

	export interface TickerAlert {
		alert: Alert;
		routeLabel: string;
	}

	let { alerts }: { alerts: TickerAlert[] } = $props();

	let currentIndex = $state(0);

	$effect(() => {
		// Re-read alerts to track it as a dependency; reset and restart cycle
		const count = alerts.length;
		currentIndex = 0;
		if (count <= 1) return;
		const id = setInterval(() => {
			currentIndex = (currentIndex + 1) % count;
		}, 8000);
		return () => clearInterval(id);
	});

	let current = $derived(alerts.length > 0 ? alerts[currentIndex % alerts.length] : null);

	let severityColor = $derived(
		current?.alert.severity === 'Severe'
			? 'var(--color-cancelled)'
			: current?.alert.severity === 'Info'
				? 'var(--color-accent)'
				: 'var(--color-alert)'
	);

	let displayText = $derived(current ? (current.alert.title || current.alert.description) : '');
</script>

{#if current}
	<div class="ticker" style="--sev-color: {severityColor}">
		<span class="sev-dot" aria-hidden="true"></span>
		{#if current.routeLabel}
			<span class="route-label">{current.routeLabel}</span>
		{/if}
		<span class="ticker-text">{displayText}</span>
		{#if alerts.length > 1}
			<span class="counter">{currentIndex + 1}/{alerts.length}</span>
		{/if}
	</div>
{/if}

<style>
	.ticker {
		flex-shrink: 0;
		height: clamp(48px, 5vh, 64px);
		background: color-mix(in srgb, var(--sev-color) 10%, var(--bg-primary));
		border-top: 1px solid color-mix(in srgb, var(--sev-color) 35%, transparent);
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 20px;
		overflow: hidden;
	}

	.sev-dot {
		width: clamp(7px, 0.6vw, 10px);
		height: clamp(7px, 0.6vw, 10px);
		border-radius: 50%;
		background: var(--sev-color);
		flex-shrink: 0;
	}

	.route-label {
		font-size: 0.82em;
		font-weight: 700;
		color: var(--sev-color);
		flex-shrink: 0;
		white-space: nowrap;
	}

	.ticker-text {
		font-size: 0.82em;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.counter {
		font-size: 0.75em;
		color: var(--text-muted);
		flex-shrink: 0;
		white-space: nowrap;
	}
</style>
