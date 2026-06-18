<script lang="ts">
	import type { Alert } from '$lib/services/nearby';
	import 'iconify-icon';

	export interface TickerAlert {
		alert: Alert;
		routeLabel: string;
	}

	let { alerts }: { alerts: TickerAlert[] } = $props();

	// Join all alerts into one continuous ticker string
	let tickerText = $derived(
		alerts
			.map((a) => {
				const label = a.routeLabel ? `[${a.routeLabel}]` : '';
				const text = a.alert.title || a.alert.description;
				return label ? `${label}  ${text}` : text;
			})
			.join('          •          ')
	);

	// ~0.22s per character so longer alerts scroll at the same readable pace; min 15s
	let duration = $derived(`${Math.max(15, Math.ceil(tickerText.length * 0.22))}s`);

	// Show the worst severity colour
	let severityColor = $derived(
		alerts.some((a) => a.alert.severity === 'Severe')
			? 'var(--color-cancelled)'
			: alerts.some((a) => a.alert.severity === 'Info')
				? 'var(--color-accent)'
				: 'var(--color-alert)'
	);
</script>

{#if alerts.length > 0}
	<div class="ticker" style="--sev-color: {severityColor}">
		<iconify-icon class="sev-icon" icon="tabler:alert-triangle" aria-hidden="true"></iconify-icon>

		<div class="scroll-wrap">
			{#key tickerText}
				<span class="scroll-text" style="--duration: {duration}">{tickerText}</span>
			{/key}
		</div>

		{#if alerts.length > 1}
			<span class="count" aria-label="{alerts.length} alerts">{alerts.length}</span>
		{/if}
	</div>
{/if}

<style>
	.ticker {
		flex-shrink: 0;
		height: clamp(64px, 7vh, 88px);
		background: color-mix(in srgb, var(--sev-color) 10%, var(--bg-primary));
		border-top: 1px solid color-mix(in srgb, var(--sev-color) 35%, transparent);
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 0 20px;
		overflow: hidden;
	}

	.sev-icon {
		font-size: clamp(24px, 2.2vw, 34px);
		color: var(--sev-color);
		flex-shrink: 0;
		display: block;
	}

	.scroll-wrap {
		flex: 1;
		overflow: hidden;
		min-width: 0;
	}

	.scroll-text {
		display: inline-block;
		white-space: nowrap;
		font-size: clamp(1em, 1.2vw, 1.15em);
		font-weight: 500;
		color: var(--text-secondary);
		/* padding-left pushes text fully off-screen right to start;
		   translateX(-100%) travels the full element width back to the left */
		padding-left: 100%;
		animation: marquee var(--duration) linear infinite;
	}

	@keyframes marquee {
		from { transform: translateX(0); }
		to   { transform: translateX(-100%); }
	}

	.count {
		font-size: 0.8em;
		font-weight: 700;
		color: var(--sev-color);
		flex-shrink: 0;
		white-space: nowrap;
		opacity: 0.8;
	}
</style>
