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
		box-sizing: border-box;
		display: flex;
		left: 0;
		padding: var(--length-spacing);
		position: fixed;
		top: 0;
		width: 100%;
	}
</style>
