<script lang="ts">
	import type { Route } from '$lib/services/nearby';

	let { route }: { route: Route } = $props();

	// Logos that contain their own internal colors and must not be recolored
	const COMPLEX_LOGOS = new Set(['ccjpaca-logo']);

	// Simple relative luminance (sRGB) — enough to detect near-black route colors
	function luminance(hex: string): number {
		if (!hex || hex.length < 6) return 0;
		const r = parseInt(hex.slice(0, 2), 16) / 255;
		const g = parseInt(hex.slice(2, 4), 16) / 255;
		const b = parseInt(hex.slice(4, 6), 16) / 255;
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	}

	// Horizon is always dark-theme. If the route color is near-black it would be
	// invisible against the dark background, so swap primary/secondary in that case.
	let shouldInvert = $derived(
		luminance(route.route_color || '') < 0.05 &&
		luminance(route.route_text_color || '') > 0.3
	);

	let primaryColor = $derived(shouldInvert ? route.route_text_color : route.route_color);
	let secondaryColor = $derived(shouldInvert ? route.route_color : route.route_text_color);

	function iconUrl(iconName: string): string {
		if (COMPLEX_LOGOS.has(iconName)) return `/api/images/${iconName}.svg`;
		const p = (primaryColor || '010101').replace('#', '');
		const s = (secondaryColor || 'FEFEFE').replace('#', '');
		return `/api/images/${iconName}.svg?primaryColor=${p}&secondaryColor=${s}`;
	}

	let elements = $derived(route.route_display_short_name?.elements ?? []);
	// elements[0] = icon identifier, elements[1] = optional adjacent text
	let iconName = $derived(elements[0] ?? null);
	let adjText = $derived(elements[1] ?? '');

	// Track which icon name was successfully loaded / failed.
	// Comparing against the current iconName means these automatically
	// become false when the route changes — no $effect needed.
	let loadedIcon = $state<string | null>(null);
	let errorIcon = $state<string | null>(null);

	let iconLoaded = $derived(loadedIcon !== null && loadedIcon === iconName);
	let iconError = $derived(errorIcon !== null && errorIcon === iconName);

	// Text badge fallback
	let label = $derived(
		route.route_display_short_name?.boxed_text ||
		route.route_short_name ||
		route.route_long_name?.split(' ')[0] ||
		'?'
	);

	let bg = $derived(`#${route.route_color || '888888'}`);
	let fg = $derived(`#${route.route_text_color || 'ffffff'}`);

	let fontSize = $derived(
		label.length > 4 ? '0.6em' :
		label.length > 3 ? '0.7em' :
		label.length > 2 ? '0.8em' : '0.95em'
	);
</script>

{#if iconName && !iconError}
	<span class="icon-wrapper">
		<!-- Show badge colour while image loads so the column doesn't flash empty -->
		{#if !iconLoaded}
			<span class="route-badge loading" style="background:{bg};"></span>
		{/if}
		<img
			class="route-img"
			class:visible={iconLoaded}
			src={iconUrl(iconName)}
			alt={route.route_short_name || ''}
			onload={() => { loadedIcon = iconName; }}
			onerror={() => { errorIcon = iconName; }}
		/>
		{#if adjText && iconLoaded}
			<span class="adj-text" style="color:{bg}">{adjText}</span>
		{/if}
	</span>
{:else}
	<span
		class="route-badge"
		style="background:{bg}; color:{fg}; font-size:{fontSize};"
		title={route.route_long_name || route.route_short_name || ''}
	>
		{label}
	</span>
{/if}

<style>
	.icon-wrapper {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-width: clamp(42px, 3.5vw, 58px);
		height: clamp(42px, 3.5vw, 58px);
	}

	.route-img {
		height: clamp(28px, 2.8vw, 46px);
		width: auto;
		max-width: clamp(64px, 6vw, 96px);
		object-fit: contain;
		display: none;
	}

	.route-img.visible {
		display: block;
	}

	.adj-text {
		font-size: 0.9em;
		font-weight: 700;
	}

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

	.route-badge.loading {
		opacity: 0.3;
	}
</style>
