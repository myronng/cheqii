<script lang="ts">
	import { goto } from '$app/navigation';
	import Loader from '$lib/components/base/loader.svelte';
	import EntryGrid from '$lib/components/entry/entryGrid.svelte';
	import EntryHeader from '$lib/components/entry/entryHeader.svelte';
	import EntryPayments from '$lib/components/entry/entryPayments.svelte';
	import EntrySettings from '$lib/components/entry/entrySettings.svelte';
	import EntrySummary from '$lib/components/entry/entrySummary.svelte';
	import { allocate } from '$lib/utils/common/allocate';
	import {
		INVITE_ACCESS,
		type ChequeData,
		type ChequeUserAccess,
		type OnChequeChange
	} from '$lib/utils/common/cheque.svelte.js';
	import { CURRENCY_FORMATTER } from '$lib/utils/common/formatter';
	import { idb } from '$lib/utils/common/indexedDb.svelte.js';
	import { getUser, type OnUserChange } from '$lib/utils/common/user.svelte';

	let { data } = $props();

	let chequeData = $state(data.cheque);
	const allocations = $derived(
		chequeData ? allocate(chequeData.contributors, chequeData.items) : null
	);
	const url = $derived(
		`${data.origin}${chequeData?.access.invite.required ? `/invite/${chequeData.access.invite.id}/${data.chequeId}` : `/cheques/${data.chequeId}`}`
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

	$effect(() => {
		if (!chequeData) {
			idb?.get<ChequeData>('cheques', data.chequeId).then(async (cheque) => {
				if (cheque) {
					// Handle cases where user access is removed while in the cheque
					await authorizeCheque(cheque);
					chequeData = cheque;
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

	const currencyFactor = Math.pow(
		10,
		CURRENCY_FORMATTER.resolvedOptions().maximumFractionDigits ?? 2
	);
</script>

{#if chequeData && allocations}
	<EntryHeader bind:chequeData {onChequeChange} strings={data.strings} {url} />
	<main style:--content={`1fr repeat(${2 + chequeData.contributors.length}, min-content)`}>
		<EntryGrid
			{allocations}
			bind:chequeData
			bind:contributorSummaryIndex
			{currencyFactor}
			currencyFormatter={CURRENCY_FORMATTER}
			{onChequeChange}
			{onUserChange}
			strings={data.strings}
			userId={data.userId}
		/>
		<EntryPayments
			{allocations}
			bind:chequeData
			currencyFormatter={CURRENCY_FORMATTER}
			{onChequeChange}
			{onUserChange}
			strings={data.strings}
			userId={data.userId}
		/>
		<EntrySummary
			{allocations}
			{chequeData}
			{contributorSummaryIndex}
			currencyFormatter={CURRENCY_FORMATTER}
			strings={data.strings}
		/>
		{#if chequeData.access.users[data.userId]?.authority === 'owner'}
			<EntrySettings
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
		position: relative;
	}

	.loader {
		align-items: center;
		display: flex;
		flex: 1;
		justify-content: center;
	}
</style>
