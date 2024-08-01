<script>
	import '../app.css';
	import Logo from '$lib/components/common/logo.svelte';
</script>

<header>
	<Logo />
</header>
<div>
	<slot />
</div>

<style>
	header {
		box-sizing: border-box;
		display: flex;
		padding: var(--length-spacing);
		width: 100%;
	}
</style>
