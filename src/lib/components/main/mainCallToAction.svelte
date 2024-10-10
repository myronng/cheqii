<script lang="ts">
	import type { User } from '$lib/utils/common/user.svelte';

	import MainHeroImage from '$lib/components/main/mainHeroImage.svelte';
	import MainNewChequeButton from '$lib/components/main/mainNewChequeButton.svelte';
	import { interpolateString, type LocalizedStrings } from '$lib/utils/common/locale';

	let { strings, userId }: { strings: LocalizedStrings; userId: User['id'] } = $props();
</script>

<section>
	<article>
		<h1>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html interpolateString(strings['a{collaborative}ChequeSplitter'], {
				collaborative: `<span style="color: var(--color-primary)">${strings['collaborative']}</span>`
			})}
		</h1>
		<p>{strings['intelligentlySplitYourGroupPurchasesUsingFewerTransactions']}</p>
		<MainNewChequeButton {strings} {userId} />
	</article>
	<MainHeroImage />
</section>

<style>
	article {
		align-items: flex-start;
		background-color: var(--color-background-surface);
		backdrop-filter: blur(var(--length-surface-blur));
		border: var(--length-divider) solid var(--color-divider);
		border-radius: var(--length-radius);
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		font-size: 1rem;
		gap: calc(var(--length-spacing) * 2);
		padding: calc(var(--length-spacing) * 2);
	}

	h1 {
		display: inline-block;
		font-family: 'Comfortaa';
		font-size: 1.5rem;
	}

	section {
		align-items: center;
		display: flex;
		gap: calc(var(--length-spacing) * 4);
		inline-size: 100%;
		max-inline-size: 900px;
	}
</style>
