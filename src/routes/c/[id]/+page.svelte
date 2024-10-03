<script lang="ts">
	import type { OnChequeChange } from '$lib/types/cheque';

	import ChequeGrid from '$lib/components/cheque/chequeGrid.svelte';
	import ChequeHeader from '$lib/components/cheque/chequeHeader.svelte';
	import ChequePayments from '$lib/components/cheque/chequePayments.svelte';
	import ChequeSummary from '$lib/components/cheque/chequeSummary.svelte';
	import type { OnUserChange, User } from '$lib/types/user';
	import { allocate, type Allocations } from '$lib/utils/common/allocate';
	import { idb } from '$lib/utils/common/indexedDb.svelte.js';

	let { data } = $props();

	let allocations = $state<Allocations>(allocate(data.cheque.items, data.cheque.contributors));
	let chequeData = $state(data.cheque);
	let contributorSummaryIndex = $state(-1);

	const onChequeChange: OnChequeChange = async () => {
		chequeData.updatedAt = Date.now();
		await idb?.put('cheques', JSON.parse(JSON.stringify(chequeData)));
	};

	const onUserChange: OnUserChange = async (userData) => {
		const existingUserData = await idb?.get<User>('users', data.userId);
		idb?.put(
			'users',
			JSON.parse(JSON.stringify({ ...existingUserData, ...userData, updatedAt: Date.now() }))
		);
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
		{onChequeChange}
		{onUserChange}
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
