<script lang="ts">
	import { config } from '$lib/stores/config';
	import { formatClock } from '$lib/utils/timeUtils';
	import DepartureBoard from '$lib/components/DepartureBoard.svelte';

	let now = $state(new Date());

	$effect(() => {
		const id = setInterval(() => { now = new Date(); }, 1000);
		return () => clearInterval(id);
	});

	let clockString = $derived(formatClock(now, 'HH:mm:ss'));
</script>

<div class="screen">
	<header class="pids-header">
		<span class="station-title">{$config.title}</span>
		<span class="clock">{clockString}</span>
	</header>

	<DepartureBoard />
</div>

<style>
	.screen {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
	}

	.pids-header {
		height: var(--header-height);
		background: var(--bg-header);
		border-bottom: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 20px;
		flex-shrink: 0;
	}

	.station-title {
		font-size: 1.35em;
		font-weight: 600;
		color: var(--text-primary);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.clock {
		font-size: 1.65em;
		font-weight: 300;
		color: var(--text-primary);
		letter-spacing: 0.06em;
	}
</style>
