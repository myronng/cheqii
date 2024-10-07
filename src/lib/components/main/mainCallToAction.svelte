<script lang="ts">
	import type { User } from '$lib/utils/common/user.svelte';

	import Button from '$lib/components/common/buttons/button.svelte';
	import { createChequeClient } from '$lib/utils/common/cheque.svelte';
	import { interpolateString, type LocalizedStrings } from '$lib/utils/common/locale';

	let { strings, userId }: { strings: LocalizedStrings; userId: User['id'] } = $props();
</script>

<article>
	<h1>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html interpolateString(strings['a{collaborative}ChequeSplitter'], {
			collaborative: `<span style="color: var(--color-primary)">${strings['collaborative']}</span>`
		})}
	</h1>
	<p>{strings['intelligentlySplitYourGroupPurchasesUsingFewerTransactions']}</p>
	<Button
		onclick={async () => {
			await createChequeClient(strings, userId);
		}}
		padding={2}>{strings['getStarted']}</Button
	>
</article>

<style>
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
</style>
