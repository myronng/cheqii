<script lang="ts">
	import ChequeGrid from '$lib/components/cheque/chequeGrid.svelte';
	import ChequeHeader from '$lib/components/cheque/chequeHeader.svelte';
	import ChequePayments from '$lib/components/cheque/chequePayments.svelte';
	import { allocate, type Allocations } from '$lib/utils/common/allocate';

	let { data } = $props();
	let allocations = $state<Allocations>(allocate(data.cheque.items, data.cheque.contributors));
	let chequeData = $state(data.cheque);

	const currencyFormatter = new Intl.NumberFormat('en-CA', {
		currency: 'CAD',
		currencyDisplay: 'narrowSymbol',
		style: 'currency'
	});
</script>

<ChequeHeader strings={data.strings} title={data.cheque.title} />
<main style:--content={`1fr repeat(${2 + chequeData.contributors.length}, min-content)`}>
	<ChequeGrid bind:allocations bind:chequeData {currencyFormatter} strings={data.strings} />
	<ChequePayments
		{allocations}
		contributors={chequeData.contributors}
		{currencyFormatter}
		strings={data.strings}
	/>
</main>

<style>
	main {
		display: grid;
		flex: 1;
		overflow: auto;
		position: relative;

		grid-template-columns:
			[full-start] 1fr
			[content-start] var(--content) [content-end]
			1fr [full-end];

		grid-template-rows: max-content;
	}
</style>
