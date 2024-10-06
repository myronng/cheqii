<script lang="ts">
	import { goto } from '$app/navigation';
	import ChequeGrid from '$lib/components/cheque/chequeGrid.svelte';
	import ChequeHeader from '$lib/components/cheque/chequeHeader.svelte';
	import ChequePayments from '$lib/components/cheque/chequePayments.svelte';
	import ChequeSettings from '$lib/components/cheque/chequeSettings.svelte';
	import ChequeSummary from '$lib/components/cheque/chequeSummary.svelte';
	import { allocate, type Allocations } from '$lib/utils/common/allocate';
	import {
		INVITE_ACCESS,
		type ChequeAccess,
		type OnChequeChange
	} from '$lib/utils/common/cheque.svelte.js';
	import { idb } from '$lib/utils/common/indexedDb.svelte.js';
	import { getUser, type OnUserChange } from '$lib/utils/common/user.svelte';

	let { data } = $props();

	let allocations = $state<Allocations>(allocate(data.cheque.contributors, data.cheque.items));
	let chequeData = $state(data.cheque);
	let contributorSummaryIndex = $state(-1);

	// Handle cases where user access is removed while in the cheque
	$effect(() => {
		if (
			chequeData.access.invite.required &&
			!INVITE_ACCESS.has(chequeData.access.users[data.userId]?.authority) &&
			!data.invited
		) {
			// Invite required but user doesn't have access
			getUser(data.userId).then((user) => {
				onUserChange({
					cheques: user.get?.cheques.filter((cheque) => cheque !== chequeData.id) ?? []
				});
				goto('/');
			});
		} else {
			// Invite not required or user has access
			getUser(data.userId).then(async (user) => {
				const userCheques = user.get?.cheques;
				const transactions: Promise<void>[] = [];
				if (!userCheques?.includes(chequeData.id)) {
					transactions.push(
						onUserChange({
							cheques: [...(userCheques ?? []), chequeData.id]
						})
					);
				}

				let accessObject: ChequeAccess | undefined;
				if (!chequeData.access.invite.required && !chequeData.access.users[data.userId]) {
					// Add user to cheque if publicly available and user doesn't already exist
					accessObject = {
						authority: 'public'
					};
				} else if (
					chequeData.access.invite.required &&
					data.invited &&
					(!chequeData.access.users[data.userId] ||
						!INVITE_ACCESS.has(chequeData.access.users[data.userId]?.authority))
				) {
					// Granted invited authority if the user doesn't have it or a greater authority
					accessObject = {
						authority: 'invited'
					};
				}
				if (accessObject) {
					if (user.get?.email) {
						accessObject.email = user.get.email;
					}
					if (user.get?.name) {
						accessObject.name = user.get.name;
					}
					if (user.get?.payment) {
						accessObject.payment = user.get.payment;
					}
					chequeData.access.users[data.userId] = accessObject;
					transactions.push(onChequeChange());
				}
				await Promise.all(transactions);
			});
		}
	});

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

	const url = $derived(
		`${data.origin}${chequeData.access.invite.required ? `/i/${chequeData.access.invite.id}/${data.pathname}` : `/c/${data.pathname}`}`
	);
</script>

<ChequeHeader bind:chequeData {onChequeChange} strings={data.strings} {url} />
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
			strings={data.strings}
			{url}
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
