<script lang="ts">
	import Button from '$lib/components/common/buttons/button.svelte';
	import MainBackground from '$lib/components/main/mainBackground.svelte';
	import MainHeroImage from '$lib/components/main/mainHeroImage.svelte';
	import { interpolateString } from '$lib/utils/common/locale';

	let { data } = $props();
</script>

<MainBackground />
<main>
	<article>
		<h1>
			{@html interpolateString(data.strings['a{collaborative}ChequeSplitter'], {
				collaborative: `<span style="color: var(--color-primary)">${data.strings['collaborative']}</span>`
			})}
		</h1>
		<p>{data.strings['intelligentlySplitYourGroupPurchasesUsingFewerTransactions']}</p>
		<Button href="/c" padding={2}>{data.strings['getStarted']}</Button>
	</article>
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

		article {
			align-items: flex-start;
			background-color: var(--color-background-surface);
			backdrop-filter: blur(var(--length-surface-blur));
			border: var(--length-divider) solid var(--color-divider);
			border-radius: var(--length-radius);
			display: flex;
			flex-direction: column;
			font-size: 1.25rem;
			gap: calc(var(--length-spacing) * 2);
			padding: calc(var(--length-spacing) * 4);
		}

		h1 {
			display: inline-block;
			font-family: 'Comfortaa';
			font-size: 2.5rem;
		}

		p {
			font-size: 1.5rem;
			line-height: 1.5;
		}
	}
</style>
