<script lang="ts">
	import { goto } from '$app/navigation';
	import ChequeGrid from '$lib/components/cheque/chequeGrid.svelte';
	import ChequeHeader from '$lib/components/cheque/chequeHeader.svelte';
	import ChequePayments from '$lib/components/cheque/chequePayments.svelte';
	import ChequeSettings from '$lib/components/cheque/chequeSettings.svelte';
	import ChequeSummary from '$lib/components/cheque/chequeSummary.svelte';
	import Loader from '$lib/components/common/loader.svelte';
	import { allocate } from '$lib/utils/common/allocate';
	import {
		INVITE_ACCESS,
		type ChequeData,
		type ChequeUserAccess,
		type OnChequeChange
	} from '$lib/utils/common/cheque.svelte.js';
	import { idb } from '$lib/utils/common/indexedDb.svelte.js';
	import { getUser, type OnUserChange } from '$lib/utils/common/user.svelte';

	let { data } = $props();

	let chequeData = $state(data.cheque);
	const allocations = $derived(
		chequeData ? allocate(chequeData.contributors, chequeData.items) : null
	);
	const url = $derived(
		`${data.origin}${chequeData?.access.invite.required ? `/i/${chequeData.access.invite.id}/${data.chequeId}` : `/c/${data.chequeId}`}`
	);
	let contributorSummaryIndex = $state(-1);

	const authorizeCheque = async (currentChequeData: ChequeData) => {
		if (
			currentChequeData.access.invite.required &&
			!INVITE_ACCESS.has(currentChequeData.access.users[data.userId]?.authority) &&
			!data.invited
		) {
			// Invite required but user doesn't have access
			const user = await getUser(data.userId);
			onUserChange({
				cheques: user.get?.cheques.filter((cheque) => cheque !== currentChequeData.id) ?? []
			});
			goto('/');
		} else {
			// Invite not required or user has access
			const user = await getUser(data.userId);
			const userCheques = user.get?.cheques;
			const transactions: Promise<void>[] = [];
			if (!userCheques?.includes(currentChequeData.id)) {
				transactions.push(
					onUserChange({
						cheques: (userCheques ?? []).concat(currentChequeData.id)
					})
				);
			}

			let userAccess: ChequeUserAccess | undefined;
			if (
				!currentChequeData.access.invite.required &&
				!currentChequeData.access.users[data.userId]
			) {
				// Add user to cheque if publicly available and user doesn't already exist
				userAccess = {
					authority: 'public'
				};
			} else if (
				currentChequeData.access.invite.required &&
				data.invited &&
				(!currentChequeData.access.users[data.userId] ||
					!INVITE_ACCESS.has(currentChequeData.access.users[data.userId]?.authority))
			) {
				// Granted invited authority if the user doesn't have it or a greater authority
				userAccess = {
					authority: 'invited'
				};
			}
			if (userAccess) {
				if (user.get?.email) {
					userAccess.email = user.get.email;
				}
				if (user.get?.name) {
					userAccess.name = user.get.name;
				}
				if (user.get?.payment) {
					userAccess.payment = user.get.payment;
				}
				currentChequeData.access.users[data.userId] = userAccess;
				transactions.push(onChequeChange(currentChequeData));
			}
			await Promise.all(transactions);
		}
	};

	// Handle cases where user access is removed while in the cheque
	$effect(() => {
		if (!chequeData) {
			idb?.get<ChequeData>('cheques', data.chequeId).then(async (cheque) => {
				if (cheque) {
					chequeData = cheque;
					await authorizeCheque(cheque);
				}
			});
		} else {
			authorizeCheque(chequeData);
		}
	});

	const onChequeChange: OnChequeChange = async (newChequeData) => {
		newChequeData.updatedAtClient = Date.now();
		await idb?.put('cheques', JSON.parse(JSON.stringify(newChequeData)));
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

{#if chequeData && allocations}
	<ChequeHeader bind:chequeData {onChequeChange} strings={data.strings} {url} />
	<main style:--content={`1fr repeat(${2 + chequeData.contributors.length}, min-content)`}>
		<ChequeGrid
			{allocations}
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
{:else}
	<div class="loader">
		<Loader />
	</div>
{/if}

<style>
	main {
		display: flex;
		flex: 1;
		flex-direction: column;
		overflow: auto;
		position: relative;
	}

	.loader {
		align-items: center;
		display: flex;
		flex: 1;
		justify-content: center;
	}
</style>
