<script lang="ts">
	import type { ChequeData } from '$lib/types/cheque';

	import ChequeGrid from '$lib/components/cheque/chequeGrid.svelte';
	import ChequeHeader from '$lib/components/cheque/chequeHeader.svelte';
	import ChequePayments from '$lib/components/cheque/chequePayments.svelte';
	import ChequeSummary from '$lib/components/cheque/chequeSummary.svelte';
	import { allocate, type Allocations } from '$lib/utils/common/allocate';
	import { idb } from '$lib/utils/common/indexedDb.svelte';

	let { data } = $props();

	let allocations = $state<Allocations>(allocate(data.cheque.items, data.cheque.contributors));
	let chequeData = $state(data.cheque);
	let contributorSummaryIndex = $state(-1);

	const onChequeChange = (newChequeData: ChequeData) => {
		chequeData.updatedAt = Date.now();
		idb?.put('cheques', JSON.parse(JSON.stringify(newChequeData)));
	};

	const currencyFormatter = new Intl.NumberFormat('en-CA', {
		currency: 'CAD',
		currencyDisplay: 'narrowSymbol',
		style: 'currency'
	});
</script>

<ChequeHeader strings={data.strings} title={data.cheque.title} />
<main style:--content={`1fr repeat(${2 + chequeData.contributors.length}, min-content)`}>
	<ChequeGrid
		bind:allocations
		bind:chequeData
		bind:contributorSummaryIndex
		{currencyFormatter}
		{onChequeChange}
		strings={data.strings}
	/>
	<ChequePayments
		{allocations}
		bind:chequeData
		{currencyFormatter}
		strings={data.strings}
		userId={data.userId}
	/>
	<ChequeSummary
		{allocations}
		{chequeData}
		{contributorSummaryIndex}
		{currencyFormatter}
		strings={data.strings}
	/>
</main>

<style>
	main {
		display: flex;
		flex: 1;
		flex-direction: column;
		overflow: auto;
		position: relative;
	}
</style>
