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
	import { PAYMENT_METHODS } from '$lib/utils/common/payments';
	import { getUser } from '$lib/utils/common/user.svelte';

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

	const paymentMethods = PAYMENT_METHODS.map((type) => ({ id: type, name: strings[type] }));
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
				{#if paymentDetails?.id && paymentDetails.method && currentUserId !== userId}
					<span class="separator">•</span>
					<div class="account details">
						<span class="method">{strings[paymentDetails.method]}</span>
						<span class="separator">•</span>
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
					</div>
				{:else if !isLinked}
					<span class="separator">•</span>
					<div class="account">
						<Button
							borderless
							onclick={async () => {
								chequeData.contributors[index].id = userId;
								const transactions: Promise<void>[] = [];
								transactions.push(onChequeChange());

								const user = await getUser(userId);
								if (user.get) {
									if (user.get.payment) {
										chequeData.access.users[userId].payment = user.get.payment;
									}

									if (!user.get.name) {
										transactions.push(onUserChange({ name: chequeData.contributors[index].name }));
									}
								}

								await Promise.all(transactions);
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
					<span class="separator">•</span>
					<div class="account details editable">
						<ChequeSelect
							onchange={async (e) => {
								const value = e.currentTarget.value as (typeof paymentMethods)[number]['id'];
								const paymentDetail = chequeData.access.users[userId].payment;
								if (!paymentDetail) {
									chequeData.access.users[userId].payment = { id: '', method: value };
								} else {
									chequeData.access.users[userId].payment = {
										...paymentDetail,
										method: value
									};
								}
								await Promise.all([
									onChequeChange(),
									onUserChange({ payment: chequeData.access.users[userId].payment })
								]);
							}}
							options={paymentMethods}
							title={strings['paymentMethod']}
							value={chequeData.access.users[currentUserId].payment?.method}
						/>
						<span class="separator">•</span>
						<ChequeInput
							inputmode="email"
							onchange={async (e) => {
								const paymentDetail = chequeData.access.users[userId].payment;
								if (!paymentDetail) {
									chequeData.access.users[userId].payment = {
										id: e.currentTarget.value,
										method: paymentMethods[0].id
									};
								} else {
									chequeData.access.users[userId].payment = {
										...paymentDetail,
										id: e.currentTarget.value
									};
								}

								await Promise.all([
									onChequeChange(),
									onUserChange({ payment: chequeData.access.users[userId].payment })
								]);
							}}
							placeholder={strings['paymentId']}
							title={strings['paymentId']}
							value={chequeData.access.users[currentUserId].payment?.id}
						/>
					</div>
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
		.account.details {
			display: flex;
			flex-wrap: wrap;
		}

		.container {
			grid-template-columns: 1fr;
			margin: var(--length-spacing);
			width: calc(100% - var(--length-spacing) * 2);
		}

		.line {
			justify-content: start;
		}

		.separator {
			display: none;
		}
	}

	@media screen and (min-width: 769px) {
		.container {
			grid-template-columns: max-content min-content max-content min-content min-content;
			margin: var(--length-spacing) auto;
		}

		.line {
			align-items: center;
		}

		.separator {
			color: var(--color-font-disabled);
		}

		.account {
			grid-column: 3 / -1;

			&.details {
				display: grid;
				grid-template-columns: subgrid;
				justify-content: space-between;
			}
		}
	}

	.container {
		border: var(--length-divider) solid var(--color-divider);
		border-radius: var(--length-radius);
		display: grid;
		font-family: JetBrains Mono;
		gap: var(--length-spacing) calc(var(--length-spacing) * 2);
		left: var(--length-spacing);
		padding: var(--length-spacing);
		position: sticky;
	}

	.details {
		align-items: center;

		&:not(.editable) {
			color: var(--color-font-disabled);
		}
	}

	.divider {
		border: 0;
		border-top: var(--length-divider) dashed var(--color-divider);
		grid-column: 1 / -1;
	}

	.editable {
		color: var(--color-primary);
	}

	.line {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
	}

	.method {
		padding: calc(var(--length-spacing) * 0.5) var(--length-spacing);
	}

	.payments {
		display: flex;
		flex-direction: column;
		gap: calc(var(--length-spacing) * 0.5);
	}
</style>
