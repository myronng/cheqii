<script lang="ts">
	import '../app.css';
	import Logo from '$lib/components/common/logo.svelte';

	let { children } = $props();
</script>

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
