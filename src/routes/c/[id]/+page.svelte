<script lang="ts">
	import type { OnChequeChange } from '$lib/types/cheque';
	import type { OnUserChange } from '$lib/types/user';

	import ChequeGrid from '$lib/components/cheque/chequeGrid.svelte';
	import ChequeHeader from '$lib/components/cheque/chequeHeader.svelte';
	import ChequePayments from '$lib/components/cheque/chequePayments.svelte';
	import ChequeSettings from '$lib/components/cheque/chequeSettings.svelte';
	import ChequeSummary from '$lib/components/cheque/chequeSummary.svelte';
	import { allocate, type Allocations } from '$lib/utils/common/allocate';
	import { idb } from '$lib/utils/common/indexedDb.svelte.js';
	import { getUser } from '$lib/utils/common/user.svelte';

	let { data } = $props();

	let allocations = $state<Allocations>(allocate(data.cheque.items, data.cheque.contributors));
	let chequeData = $state(data.cheque);
	let contributorSummaryIndex = $state(-1);

	const onChequeChange: OnChequeChange = async () => {
		chequeData.updatedAt = Date.now();
		await idb?.put('cheques', JSON.parse(JSON.stringify(chequeData)));
	};

	const onUserChange: OnUserChange = async (userData) => {
		const user = await getUser(data.userId);
		await user.set(userData);
	};

	const currencyFormatter = new Intl.NumberFormat('en-CA', {
		currency: 'CAD',
		currencyDisplay: 'narrowSymbol',
		style: 'currency'
	});
	const currencyFactor = Math.pow(
		10,
		currencyFormatter.resolvedOptions().maximumFractionDigits ?? 2
	);
</script>

<ChequeHeader bind:chequeData {onChequeChange} strings={data.strings} userId={data.userId} />
<main style:--content={`1fr repeat(${2 + chequeData.contributors.length}, min-content)`}>
	<ChequeGrid
		bind:allocations
		bind:chequeData
		bind:contributorSummaryIndex
		{currencyFactor}
		{currencyFormatter}
		{onChequeChange}
		{onUserChange}
		strings={data.strings}
		userId={data.userId}
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
	{#if chequeData.access.users[data.userId]?.authority === 'owner'}
		<ChequeSettings
			bind:chequeData
			{currencyFactor}
			{onChequeChange}
			{onUserChange}
			origin={data.origin}
			pathname={data.pathname}
			strings={data.strings}
			userId={data.userId}
		/>
	{/if}
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
