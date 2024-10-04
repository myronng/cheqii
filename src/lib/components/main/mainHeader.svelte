<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import Logo from '$lib/components/common/logo.svelte';

	let { strings }: { strings: LocalizedStrings } = $props();
</script>

<svelte:head>
	<title>Cheqii</title>
</svelte:head>

<header>
	<Logo {strings} />
</header>

<style>
	header {
		display: flex;
		padding: var(--length-spacing);
	}
</style>
