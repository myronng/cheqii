<script lang="ts">
	import type { ChequeData, OnChequeChange } from '$lib/utils/common/cheque.svelte';
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import Button from '$lib/components/common/buttons/button.svelte';
	import Settings from '$lib/components/common/icons/settings.svelte';
	import Logo from '$lib/components/common/logo.svelte';
	import EntryName from '$lib/components/entry/entryName.svelte';
	import EntryShare from '$lib/components/entry/entryShare.svelte';

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
		<Logo hasTitle={false} href="/cheques" {strings} />
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
		border-bottom: var(--length-divider) solid var(--color-divider);
		display: flex;
		flex-wrap: wrap;
		gap: var(--length-spacing);
		justify-content: space-between;
		padding: var(--length-spacing);

		section {
			display: flex;
			gap: var(--length-spacing);
		}
	}
</style>
