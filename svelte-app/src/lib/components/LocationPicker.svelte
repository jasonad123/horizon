<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';

	let {
		lat,
		lon,
		onchange
	}: {
		lat: number | null;
		lon: number | null;
		onchange: (lat: number, lon: number) => void;
	} = $props();

	let mapContainer = $state<HTMLElement | null>(null);
	let mapInstance = $state<ReturnType<typeof import('leaflet')['map']> | null>(null);
	let markerInstance = $state<ReturnType<typeof import('leaflet')['marker']> | null>(null);

	function makeIcon(L: typeof import('leaflet')) {
		return L.divIcon({
			className: '',
			html: `<svg viewBox="0 0 24 36" width="24" height="36" xmlns="http://www.w3.org/2000/svg">
				<path d="M12 0C7.6 0 4 3.6 4 8c0 5.5 8 20 8 20s8-14.5 8-20c0-4.4-3.6-8-8-8z" fill="#3a7bd5"/>
				<circle cx="12" cy="8" r="4" fill="white"/>
			</svg>`,
			iconSize: [24, 36],
			iconAnchor: [12, 36]
		});
	}

	$effect(() => {
		if (!browser || !mapContainer) return;

		const initLat = untrack(() => lat);
		const initLon = untrack(() => lon);
		let alive = true;

		import('leaflet').then((L) => {
			if (!alive || !mapContainer) return;

			const center: [number, number] = initLat != null && initLon != null
				? [initLat, initLon]
				: [40.7128, -74.006];
			const zoom = initLat != null ? 14 : 3;

			const map = L.map(mapContainer!, { zoomControl: true }).setView(center, zoom);

			L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
				subdomains: 'abcd',
				maxZoom: 19
			}).addTo(map);

			const icon = makeIcon(L);

			const marker = initLat != null && initLon != null
				? L.marker([initLat, initLon], { draggable: true, icon }).addTo(map)
				: null;

			if (marker) {
				marker.on('dragend', () => {
					const pos = marker.getLatLng();
					onchange(pos.lat, pos.lng);
				});
			}

			map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
				const { lat: clickLat, lng: clickLon } = e.latlng;
				if (markerInstance) {
					markerInstance.setLatLng([clickLat, clickLon]);
				} else {
					const newMarker = L.marker([clickLat, clickLon], { draggable: true, icon }).addTo(map);
					newMarker.on('dragend', () => {
						const pos = newMarker.getLatLng();
						onchange(pos.lat, pos.lng);
					});
					markerInstance = newMarker;
				}
				onchange(clickLat, clickLon);
			});

			mapInstance = map;
			markerInstance = marker;
		});

		return () => {
			alive = false;
			if (mapInstance) {
				mapInstance.remove();
				mapInstance = null;
				markerInstance = null;
			}
		};
	});

	// Sync external lat/lon changes (e.g. from geo button or text field) to the map
	$effect(() => {
		if (!mapInstance || lat == null || lon == null) return;
		const pos: [number, number] = [lat, lon];
		if (markerInstance) {
			markerInstance.setLatLng(pos);
		} else {
			import('leaflet').then((L) => {
				if (!mapInstance) return;
				const icon = makeIcon(L);
				const m = L.marker(pos, { draggable: true, icon }).addTo(mapInstance);
				m.on('dragend', () => {
					const p = m.getLatLng();
					onchange(p.lat, p.lng);
				});
				markerInstance = m;
			});
		}
		mapInstance.setView(pos, Math.max(mapInstance.getZoom(), 14));
	});
</script>

<svelte:head>
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div class="map-wrap">
	{#if !browser}
		<div class="map-placeholder">Map loading...</div>
	{:else}
		<div class="map-container" bind:this={mapContainer}></div>
		{#if lat == null}
			<div class="map-hint">Click the map to set a location</div>
		{/if}
	{/if}
</div>

<style>
	.map-wrap {
		position: relative;
		height: clamp(200px, 28vh, 320px);
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid var(--border-color);
		margin-top: 16px;
	}

	.map-container {
		width: 100%;
		height: 100%;
	}

	.map-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.03);
		color: var(--text-muted);
		font-size: 0.9em;
	}

	.map-hint {
		position: absolute;
		bottom: 10px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.65);
		color: var(--text-secondary);
		font-size: 0.78em;
		padding: 5px 12px;
		border-radius: 4px;
		pointer-events: none;
		white-space: nowrap;
	}
</style>
