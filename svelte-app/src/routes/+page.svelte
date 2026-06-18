<script lang="ts">
	import { config } from '$lib/stores/config';
	import { formatClock } from '$lib/utils/timeUtils';
	import DepartureBoard from '$lib/components/DepartureBoard.svelte';
	import SetupOverlay from '$lib/components/SetupOverlay.svelte';
	import 'iconify-icon';

	let now = $state(new Date());
	let showSetup = $state(false);

	$effect(() => {
		const id = setInterval(() => { now = new Date(); }, 1000);
		return () => clearInterval(id);
	});

	let clockFormat = $derived<'HH:mm' | 'hh:mm A' | 'HH:mm:ss'>($config.timeFormat === 'hh:mm A' ? 'hh:mm A' : 'HH:mm:ss');
	let clockString = $derived(formatClock(now, clockFormat));

	// Show setup when nothing is configured yet
	let needsSetup = $derived(
		$config.loaded &&
		!$config.location &&
		$config.selectedStopIds.length === 0
	);

	function openSettings() {
		showSetup = true;
	}

	function onSetupComplete() {
		showSetup = false;
	}

	// Press 'S' to re-open settings
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 's' && !e.ctrlKey && !e.metaKey) openSettings();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if needsSetup || showSetup}
	<SetupOverlay
		oncomplete={onSetupComplete}
		oncancel={showSetup && !needsSetup ? () => { showSetup = false; } : undefined}
	/>
{:else}
	<div class="screen" class:mono={$config.monoMode}>
		<header class="pids-header">
			<button class="station-title" onclick={openSettings} title="Settings (S)">
				{$config.title}
			</button>
			<span class="clock">{clockString}</span>
		</header>

		<DepartureBoard />
	</div>
{/if}

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
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0;
		font-family: inherit;
		/* Subtle affordance — only visible on hover */
		transition: color 0.2s;
	}

	.station-title:hover {
		color: var(--text-secondary);
	}

	.clock {
		font-size: 1.65em;
		font-weight: 300;
		color: var(--text-primary);
		letter-spacing: 0.06em;
	}
</style>
