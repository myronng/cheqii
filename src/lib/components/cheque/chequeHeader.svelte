<script lang="ts">
	import type { ChequeData, OnChequeChange } from '$lib/utils/common/cheque.svelte';
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import ChequeName from '$lib/components/cheque/chequeName.svelte';
	import ChequeShare from '$lib/components/cheque/chequeShare.svelte';
	import IconButton from '$lib/components/common/buttons/iconButton.svelte';
	import Settings from '$lib/components/common/icons/settings.svelte';
	import Logo from '$lib/components/common/logo.svelte';

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

<header>
	<section>
		<Logo hasTitle={false} {strings} />
		<ChequeName bind:chequeData {onChequeChange} {strings} />
	</section>
	<section>
		<ChequeShare {strings} title={chequeData.name} {url} />
		<IconButton
			onclick={() => {
				(document.getElementById('settingsDialog') as HTMLDialogElement).showModal();
			}}
			title={strings['settings']}
		>
			<Settings height="32px" stroke-width="1.5" width="32px" />
		</IconButton>
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
