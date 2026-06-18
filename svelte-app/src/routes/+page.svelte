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

	const HEADER_ICONS: Record<string, string> = {
		train: 'bxs:train',
		bus: 'mdi:bus',
		metro: 'mdi:subway-variant',
		tram: 'mdi:tram',
		ferry: 'mdi:ferry'
	};
	let headerIconName = $derived($config.headerIcon !== 'none' ? HEADER_ICONS[$config.headerIcon] ?? null : null);

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
				{#if headerIconName}
					<span class="header-icon-wrap">
						<iconify-icon icon={headerIconName} aria-hidden="true"></iconify-icon>
					</span>
				{/if}
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
		border-bottom: 2px solid var(--border-header);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px;
		flex-shrink: 0;
	}

	.station-title {
		display: flex;
		align-items: center;
		gap: 14px;
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
		transition: color 0.2s;
	}

	.header-icon-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		width: clamp(34px, 3vw, 46px);
		height: clamp(34px, 3vw, 46px);
		background: var(--color-accent);
		border-radius: 6px;
		color: #fff;
		font-size: clamp(18px, 1.8vw, 26px);
		flex-shrink: 0;
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
