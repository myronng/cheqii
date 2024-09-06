<script lang="ts">
	import Logo from '$lib/components/common/logo.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Cheqii</title>
</svelte:head>

<header>
	<Logo />
</header>
{@render children()}

<style>
	header {
		display: flex;
		padding: var(--length-spacing);
	}
</style>
