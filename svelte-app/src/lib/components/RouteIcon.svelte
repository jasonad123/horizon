<script lang="ts">
	import type { Route } from '$lib/services/nearby';

	let { route }: { route: Route } = $props();

	let bg = $derived(`#${route.route_color || '888888'}`);
	let fg = $derived(`#${route.route_text_color || 'ffffff'}`);

	// elements[] contains icon identifiers (e.g. "mta-subway-7"), not display text.
	// Use route_short_name as the text label; boxed_text overrides for branded routes.
	let label = $derived(
		route.route_display_short_name?.boxed_text ||
		route.route_short_name ||
		route.route_long_name?.split(' ')[0] ||
		'?'
	);

	let fontSize = $derived(
		label.length > 4 ? '0.6em' :
		label.length > 3 ? '0.7em' :
		label.length > 2 ? '0.8em' : '0.95em'
	);
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
		min-width: clamp(42px, 3.5vw, 58px);
		height: clamp(42px, 3.5vw, 58px);
		padding: 0 8px;
		border-radius: 5px;
		font-weight: 800;
		letter-spacing: -0.01em;
		white-space: nowrap;
		flex-shrink: 0;
	}
</style>
