<script lang="ts">
	import type { Route } from '$lib/services/nearby';

	let { route }: { route: Route } = $props();

	let bg = $derived(`#${route.route_color || '888888'}`);
	let fg = $derived(`#${route.route_text_color || 'ffffff'}`);

	let label = $derived(
		route.route_display_short_name?.boxed_text ||
		route.route_display_short_name?.elements?.join('') ||
		route.route_short_name ||
		route.route_long_name?.split(' ')[0] ||
		'?'
	);

	// Shrink font for longer labels
	let fontSize = $derived(label.length > 3 ? '0.65em' : label.length > 2 ? '0.75em' : '0.85em');
</script>

<span
	class="route-badge"
	style="background:{bg}; color:{fg}; font-size:{fontSize};"
	title={route.route_long_name || route.route_short_name || ''}
>
	{label}
</span>

<style>
	.route-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		height: 32px;
		padding: 0 6px;
		border-radius: 4px;
		font-weight: 700;
		font-family: var(--font-mono);
		letter-spacing: -0.02em;
		white-space: nowrap;
		flex-shrink: 0;
	}
</style>
