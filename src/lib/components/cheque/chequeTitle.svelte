<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import Input from '$lib/components/common/input.svelte';
	import type { ChequeData, OnChequeChange } from '$lib/types/cheque';

	let {
		chequeData = $bindable(),
		onChequeChange,
		strings,
		title
	}: {
		chequeData: ChequeData;
		onChequeChange: OnChequeChange;
		strings: LocalizedStrings;
		title: string;
	} = $props();
</script>

<svelte:head>
	<title>{chequeData.title}</title>
</svelte:head>

<Input
	onchange={async (e) => {
		chequeData.title = e.currentTarget.value;
		await onChequeChange();
	}}
	placeholder={strings['chequeTitle']}
	title={strings['chequeTitle']}
	value={chequeData.title}
/>
