<script lang="ts">
	import ChequeGrid from '$lib/components/cheque/chequeGrid.svelte';
	import ChequeHeader from '$lib/components/cheque/chequeHeader.svelte';
	import ChequePayments from '$lib/components/cheque/chequePayments.svelte';
	import { allocate, type Allocations } from '$lib/utils/common/allocate';
	import type { ComponentProps } from 'svelte';

	let { data } = $props();
	let allocations = $state<Allocations>(allocate(data.cheque.items, data.cheque.contributors));
	let contributors = $state(data.cheque.contributors);

	const currencyFormatter = new Intl.NumberFormat('en-CA', {
		currency: 'CAD',
		currencyDisplay: 'narrowSymbol',
		style: 'currency'
	});

	const onAllocate: ComponentProps<typeof ChequeGrid>['onAllocate'] = (allocateResults) => {
		allocations = allocateResults;
	};

	const onContributorChange: ComponentProps<typeof ChequeGrid>['onContributorChange'] = (
		newContributors
	) => {
		contributors = newContributors;
	};
</script>

<ChequeHeader strings={data.strings} title={data.cheque.title} />
<main style:--content={`1fr repeat(${2 + contributors.length}, min-content)`}>
	<ChequeGrid
		{allocations}
		chequeData={data.cheque}
		{currencyFormatter}
		{onAllocate}
		{onContributorChange}
		strings={data.strings}
	/>
	<ChequePayments {allocations} {contributors} {currencyFormatter} strings={data.strings} />
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
