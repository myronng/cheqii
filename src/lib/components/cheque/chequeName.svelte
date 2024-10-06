<script lang="ts">
	import type { ChequeData, OnChequeChange } from '$lib/utils/common/cheque.svelte';

	import Input from '$lib/components/common/input.svelte';
	import { interpolateString, type LocalizedStrings } from '$lib/utils/common/locale';

	let {
		chequeData = $bindable(),
		onChequeChange,
		strings
	}: {
		chequeData: ChequeData;
		onChequeChange: OnChequeChange;
		strings: LocalizedStrings;
	} = $props();
</script>

<svelte:head>
	<title>{chequeData.name}</title>
</svelte:head>

<Input
	onchange={async (e) => {
		if (!e.currentTarget.value) {
			chequeData.name = interpolateString(strings['cheque{date}'], {
				date: new Date().toISOString().split('T')[0]
			});
		} else {
			chequeData.name = e.currentTarget.value;
		}
		await onChequeChange();
	}}
	placeholder={strings['chequeName']}
	required
	title={strings['chequeName']}
	value={chequeData.name}
/>
