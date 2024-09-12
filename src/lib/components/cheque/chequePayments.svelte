<script lang="ts">
	import Button from '$lib/components/common/buttons/button.svelte';
	import Link from '$lib/components/common/icons/link.svelte';
	import type { Contributor } from '$lib/types/cheque';
	import type { Allocations } from '$lib/utils/common/allocate';
	import { MaxHeap } from '$lib/utils/common/heap';
	import { interpolateString, type LocalizedStrings } from '$lib/utils/common/locale';
	import { getNumericDisplay } from '$lib/utils/common/parseNumeric';

	let {
		allocations,
		contributors,
		currencyFormatter,
		strings
	}: {
		allocations: Allocations;
		contributors: Contributor[];
		currencyFormatter: Intl.NumberFormat;
		strings: LocalizedStrings;
	} = $props();

	const getAllocationStrings = (allocations: Allocations) => {
		const allocationStrings: Map<number, { payee: string; payments: string[] }> = new Map();
		const unaccountedStrings: string[] = [];
		const owingHeap = new MaxHeap();
		const paidHeap = new MaxHeap();
		for (const [index, contribution] of allocations.contributions) {
			const balance = contribution.paid - contribution.owing;
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
		{#each allocationStrings as [_, { payee, payments }]}
			<article class="line">
				<div class="payments">
					{#each payments as payment}
						<span>
							{payment}
						</span>
					{/each}
				</div>
				<Button borderless padding={0.5}>
					<Link />
					{interpolateString(strings['linkPaymentAccountTo{payee}'], {
						payee
					})}
				</Button>
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

		.line {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media screen and (min-width: 768px) {
		.container {
			margin: var(--length-spacing) auto;
		}

		.line {
			align-items: center;
			gap: var(--length-spacing);
		}
	}

	.container {
		border: var(--length-divider) solid var(--color-divider);
		border-radius: var(--length-radius);
		display: flex;
		flex-direction: column;
		left: var(--length-spacing);
		position: sticky;
		word-break: break-word;
	}

	.line {
		display: flex;
		justify-content: space-between;
		padding: var(--length-spacing);

		&:not(:last-child) {
			border-bottom: var(--length-divider) dashed var(--color-divider);
		}
	}

	.payments {
		display: flex;
		flex-direction: column;
		gap: calc(var(--length-spacing) * 0.5);
		font: 1rem JetBrains Mono;
	}
</style>
