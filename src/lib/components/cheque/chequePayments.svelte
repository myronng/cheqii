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
		const allocationStrings: { payee: string; payment: string }[] = [];
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
				if (currentPaid.value >= currentOwing.value) {
					allocationStrings.push({
						payee: contributors[currentPaid.index].name,
						payment: interpolateString(strings['{payer}Sends{payee}{value}'], {
							payee: contributors[currentPaid.index].name,
							payer: contributors[currentOwing.index].name,
							value: getNumericDisplay(currencyFormatter, currentOwing.value)
						})
					});
					currentPaid.value -= currentOwing.value;
					currentOwing.value = 0;
				} else {
					allocationStrings.push({
						payee: contributors[currentPaid.index].name,
						payment: interpolateString(strings['{payer}Sends{payee}{value}'], {
							payee: contributors[currentPaid.index].name,
							payer: contributors[currentOwing.index].name,
							value: getNumericDisplay(currencyFormatter, currentPaid.value)
						})
					});
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

<section class="payments">
	{#if allocations !== null}
		{@const { allocationStrings, unaccountedStrings } = getAllocationStrings(allocations)}
		{#each allocationStrings as allocation}
			<article>
				<span class="payment">
					{allocation.payment}
				</span>
				<Button borderless padding={0.5}>
					<Link />
					{interpolateString(strings['linkPaymentAccountTo{payee}'], {
						payee: allocation.payee
					})}
				</Button>
			</article>
		{/each}
		{#each unaccountedStrings as unaccounted}
			<article>
				{unaccounted}
			</article>
		{/each}
	{/if}
</section>

<style>
	@container (max-width: 768px) {
		section {
			margin: var(--length-spacing);
			width: calc(100% - var(--length-spacing) * 2);

			& > article {
				align-items: flex-start;
				flex-direction: column;
			}
		}
	}

	@container (min-width: 768px) {
		section {
			margin: 0 auto;

			& > article {
				align-items: center;
				gap: var(--length-spacing);
			}
		}
	}

	section {
		border: var(--length-divider) solid var(--color-divider);
		border-radius: var(--length-radius);
		display: flex;
		flex-direction: column;
		grid-column: full;
		left: var(--length-spacing);
		margin-bottom: auto;
		position: sticky;

		& > article {
			display: flex;
			justify-content: space-between;
			padding: var(--length-spacing);

			&:not(:last-child) {
				border-bottom: var(--length-divider) dashed var(--color-divider);
			}
		}
	}

	.payment {
		font: 1rem JetBrains Mono;
	}
</style>
