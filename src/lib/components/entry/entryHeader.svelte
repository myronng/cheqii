<script lang="ts">
	import type { ChequeData, OnChequeChange } from '$lib/utils/common/cheque.svelte';
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import Button from '$lib/components/base/buttons/button.svelte';
	import Logo from '$lib/components/base/logo.svelte';
	import EntryName from '$lib/components/entry/entryName.svelte';
	import EntryShare from '$lib/components/entry/entryShare.svelte';
	import Settings from '$lib/components/icons/settings.svelte';

	let {
		chequeData = $bindable(),
		onChequeChange,
		strings,
		url
	}: {
		chequeData: ChequeData;
		onChequeChange: OnChequeChange;
		strings: LocalizedStrings;
		url: string;
	} = $props();
</script>

{#snippet icon()}
	<Settings variant="button" />
{/snippet}

<header>
	<section>
		<Logo hasTitle={false} {strings} />
		<EntryName bind:chequeData {onChequeChange} {strings} />
	</section>
	<section>
		<EntryShare {strings} title={chequeData.name} {url} />
		<Button
			borderless
			{icon}
			onclick={() => {
				(document.getElementById('settingsDialog') as HTMLDialogElement).showModal();
			}}
			title={strings['settings']}
		/>
	</section>
</header>

<style>
	header {
		background-color: var(--color-background-primary);
		border-bottom: var(--length-divider) solid var(--color-divider);
		display: flex;
		flex-wrap: wrap;
		gap: var(--length-spacing);
		justify-content: space-between;
		padding: var(--length-spacing);
		position: sticky;
		top: 0;
		z-index: 1000;

		section {
			display: flex;
			gap: var(--length-spacing);
		}
	}
</style>
