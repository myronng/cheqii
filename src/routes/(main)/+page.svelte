<script lang="ts">
	import MainBackground from '$lib/components/main/mainBackground.svelte';
	import MainCallToAction from '$lib/components/main/mainCallToAction.svelte';
	import MainHeader from '$lib/components/main/mainHeader.svelte';
	import MainHeroImage from '$lib/components/main/mainHeroImage.svelte';

	let { data } = $props();
</script>

<MainHeader strings={data.strings} userId={data.userId} />
<MainBackground />
<main>
	<MainCallToAction strings={data.strings} userId={data.userId} />
	<MainHeroImage />
</main>

<style>
	@media screen and (max-width: 768px) {
		main {
			flex-direction: column;
		}
	}
	main {
		align-items: center;
		display: flex;
		flex: 1;
		gap: calc(var(--length-spacing) * 4);
		justify-content: space-around;
		padding: calc(var(--length-spacing) * 4);
		position: relative;
	}
</style>
