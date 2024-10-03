<script lang="ts">
	import type { ChequeData, OnChequeChange } from '$lib/types/cheque';
	import type { OnUserChange, User } from '$lib/types/user';
	import type { Allocations } from '$lib/utils/common/allocate';

	import ChequeInput from '$lib/components/cheque/chequeInput.svelte';
	import ChequeSelect from '$lib/components/cheque/chequeSelect.svelte';
	import Button from '$lib/components/common/buttons/button.svelte';
	import Copy from '$lib/components/common/icons/copy.svelte';
	import Link from '$lib/components/common/icons/link.svelte';
	import { MaxHeap } from '$lib/utils/common/heap';
	import { interpolateString, type LocalizedStrings } from '$lib/utils/common/locale';
	import { getNumericDisplay } from '$lib/utils/common/parseNumeric';
	import { PAYMENT_TYPES } from '$lib/utils/common/payments';

	let {
		allocations,
		chequeData = $bindable(),
		currencyFormatter,
		onChequeChange,
		onUserChange,
		strings,
		userId
	}: {
		allocations: Allocations;
		chequeData: ChequeData;
		currencyFormatter: Intl.NumberFormat;
		onChequeChange: OnChequeChange;
		onUserChange: OnUserChange;
		strings: LocalizedStrings;
		userId: User['id'];
	} = $props();

	const paymentTypes = PAYMENT_TYPES.map((type) => ({ id: type, name: strings[type] }));
	const getAllocationStrings = (allocations: Allocations) => {
		const allocationStrings: Map<number, { payee: string; payments: string[] }> = new Map();
		const unaccountedStrings: string[] = [];
		const contributors = chequeData.contributors;
		const owingHeap = new MaxHeap();
		const paidHeap = new MaxHeap();
		for (const [index, contribution] of allocations.contributions) {
			const balance = contribution.paid.total - contribution.owing.total;
			if (balance > 0) {
				paidHeap.insert({ index, value: balance });
			} else if (balance < 0) {
				owingHeap.insert({ index, value: Math.abs(balance) });
			}
		}
		let currentOwing = owingHeap.extractMax();
		let currentPaid;
		while ((currentOwing?.value ?? 0) > 0) {
			if (!currentPaid?.value) {
				currentPaid = paidHeap.extractMax();
			}
			if (currentPaid && currentOwing) {
				const currentAllocationString = allocationStrings.get(currentPaid.index);
				let payments: string[] = [];
				if (!currentAllocationString) {
					allocationStrings.set(currentPaid.index, {
						payee: contributors[currentPaid.index].name,
						payments
					});
				} else {
					payments = currentAllocationString.payments;
				}
				if (currentPaid.value >= currentOwing.value) {
					payments.push(
						interpolateString(strings['{payer}Sends{payee}{value}'], {
							payee: contributors[currentPaid.index].name,
							payer: contributors[currentOwing.index].name,
							value: getNumericDisplay(currencyFormatter, currentOwing.value)
						})
					);
					currentPaid.value -= currentOwing.value;
					currentOwing.value = 0;
				} else {
					payments.push(
						interpolateString(strings['{payer}Sends{payee}{value}'], {
							payee: contributors[currentPaid.index].name,
							payer: contributors[currentOwing.index].name,
							value: getNumericDisplay(currencyFormatter, currentPaid.value)
						})
					);
					currentOwing.value -= currentPaid.value;
					currentPaid.value = 0;
				}
			} else {
				const unaccountedValue = currentPaid?.value ?? currentOwing?.value ?? 0;
				if (unaccountedValue) {
					unaccountedStrings.push(
						interpolateString(strings['{value}UnaccountedFor'], {
							value: getNumericDisplay(currencyFormatter, unaccountedValue)
						})
					);
				}
				if (currentOwing) {
					currentOwing.value = 0;
				}
				if (currentPaid) {
					currentPaid.value = 0;
				}
			}
			if (!currentOwing?.value) {
				currentOwing = owingHeap.extractMax();
			}
		}
		return { allocationStrings, unaccountedStrings };
	};
</script>

<section class="container">
	{#if allocations !== null}
		{@const { allocationStrings, unaccountedStrings } = getAllocationStrings(allocations)}
		{@const isLinked = chequeData.contributors.some(({ id }) => id === userId)}
		{#each allocationStrings as [index, { payee, payments }]}
			{@const currentUserId = chequeData.contributors[index].id}
			{@const paymentDetails = chequeData.access.users[currentUserId]?.payment}
			{#if index !== 0}
				<hr class="divider" />
			{/if}
			<article class="line">
				<div class="payments">
					{#each payments as payment}
						<span>
							{payment}
						</span>
					{/each}
				</div>
				{#if paymentDetails?.id && paymentDetails.type && currentUserId !== userId}
					<span class="disabled">•</span>
					<span class="disabled type">{strings[paymentDetails.type]}</span>
					<span class="disabled">•</span>
					<Button
						borderless
						onclick={() => {
							navigator.clipboard.writeText(paymentDetails.id);
						}}
						padding={0.5}
					>
						<Copy />
						{paymentDetails.id}
					</Button>
				{:else if !isLinked}
					<span class="disabled">•</span>
					<div class="unlinked">
						<Button
							borderless
							onclick={async () => {
								chequeData.contributors[index].id = userId;
								onChequeChange();
							}}
							padding={0.5}
						>
							<Link />
							{interpolateString(strings['linkPaymentAccountTo{payee}'], {
								payee
							})}
						</Button>
					</div>
				{:else if currentUserId === userId}
					<span class="disabled">•</span>
					<ChequeSelect
						onchange={(e) => {
							const value = e.currentTarget.value as (typeof paymentTypes)[number]['id'];
							const paymentDetail = chequeData.access.users[userId].payment;
							if (!paymentDetail) {
								chequeData.access.users[userId].payment = { id: '', type: value };
							} else {
								chequeData.access.users[userId].payment = {
									...paymentDetail,
									type: value
								};
							}
							onChequeChange();
							onUserChange({ payment: chequeData.access.users[userId].payment });
						}}
						options={paymentTypes}
						value={chequeData.access.users[currentUserId].payment?.type}
					/>
					<span class="disabled">•</span>
					<ChequeInput
						inputmode="email"
						onchange={(e) => {
							const paymentDetail = chequeData.access.users[userId].payment;
							if (!paymentDetail) {
								chequeData.access.users[userId].payment = {
									id: e.currentTarget.value,
									type: paymentTypes[0].id
								};
							} else {
								chequeData.access.users[userId].payment = {
									...paymentDetail,
									id: e.currentTarget.value
								};
							}
							onChequeChange();
							onUserChange({ payment: chequeData.access.users[userId].payment });
						}}
						placeholder={strings['paymentId']}
						value={chequeData.access.users[currentUserId].payment?.id}
					/>
				{/if}
			</article>
		{/each}
		{#each unaccountedStrings as unaccounted}
			<article class="line">
				{unaccounted}
			</article>
		{/each}
	{/if}
</section>

<style>
	@media screen and (max-width: 768px) {
		.container {
			margin: var(--length-spacing);
			width: calc(100% - var(--length-spacing) * 2);
		}
	}

	@media screen and (min-width: 768px) {
		.container {
			margin: var(--length-spacing) auto;
		}

		.line {
			align-items: center;
			gap: calc(var(--length-spacing) * 2);
		}
	}

	.container {
		border: var(--length-divider) solid var(--color-divider);
		border-radius: var(--length-radius);
		display: grid;
		font-family: JetBrains Mono;
		grid-template-columns: max-content min-content max-content min-content min-content;
		gap: var(--length-spacing);
		left: var(--length-spacing);
		padding: var(--length-spacing);
		position: sticky;
	}

	.disabled {
		color: var(--color-font-disabled);
	}

	.divider {
		border: 0;
		border-top: var(--length-divider) dashed var(--color-divider);
		grid-column: 1 / -1;
	}

	.line {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
	}

	.payments {
		display: flex;
		flex-direction: column;
		gap: calc(var(--length-spacing) * 0.5);
	}

	.type {
		padding: calc(var(--length-spacing) * 0.5) var(--length-spacing);
		text-align: center;
	}

	.unlinked {
		grid-column: 3 / -1;
	}
</style>
