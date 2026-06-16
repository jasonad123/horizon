<script lang="ts">
	import { onMount } from 'svelte';
	import { config } from '$lib/stores/config';
	import '../app.css';

	let { children } = $props();

	onMount(async () => {
		await config.load();
	});
</script>

{@render children()}
