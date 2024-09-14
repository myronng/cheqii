<script lang="ts">
	import IconButton from '$lib/components/common/buttons/iconButton.svelte';
	import Cancel from '$lib/components/common/icons/cancel.svelte';
	import type { ChequeData } from '$lib/types/cheque';
	import type { Allocations } from '$lib/utils/common/allocate';
	import { interpolateString, type LocalizedStrings } from '$lib/utils/common/locale';
	import { getNumericDisplay } from '$lib/utils/common/parseNumeric';

	let {
		allocations,
		chequeData,
		contributorSummaryIndex,
		currencyFormatter,
		strings
	}: {
		allocations: Allocations;
		chequeData: ChequeData;
		contributorSummaryIndex: number;
		currencyFormatter: Intl.NumberFormat;
		strings: LocalizedStrings;
	} = $props();
	const contribution = $derived(allocations.contributions.get(contributorSummaryIndex));
</script>

<dialog id="summaryDialog">
	{#if contributorSummaryIndex >= 0}
		<div class="content">
			<h1 class="title">
				<span>{chequeData.contributors[contributorSummaryIndex].name}</span>
				<IconButton
					onclick={() => {
						(document.getElementById('summaryDialog') as HTMLDialogElement).close();
					}}
				>
					<Cancel height={24} width={24} />
				</IconButton>
			</h1>
			<section class="summaries">
				{#if contribution}
					<article class="summary paid">
						<span class="disabled">
							{strings['paid']}
						</span>
						<span class="disabled">
							{strings['cost']}
						</span>
						{#each contribution.paid.items as paidItem}
							{@const isVoid = paidItem.cost === 0}
							<span class={isVoid ? 'void' : undefined}>
								{paidItem.name}
							</span>
							<span class={isVoid ? 'numeric void' : 'numeric'}>
								{getNumericDisplay(currencyFormatter, paidItem.cost)}
							</span>
						{/each}
						<hr class="divider" />
						<span class="disabled">{strings['subtotal']}</span>
						<span>{getNumericDisplay(currencyFormatter, contribution.owing.total)}</span>
					</article>
					<article class="summary owing">
						<span class="disabled">
							{strings['owing']}
						</span>
						<span class="disabled"></span>
						<span class="disabled">
							{strings['cost']}
						</span>
						{#each contribution.owing.items as owingItem}
							{@const isVoid =
								owingItem.cost === 0 ||
								owingItem.split.denominator === 0 ||
								owingItem.split.multiplicand === 0 ||
								owingItem.split.numerator === 0}
							<span class={isVoid ? 'void' : undefined}>
								{owingItem.name}
							</span>
							<span class={isVoid ? 'numeric void' : 'disabled numeric'}>
								{interpolateString(
									strings['owingCalculation{multiplicand}{numerator}{denominator}'],
									{
										multiplicand: getNumericDisplay(
											currencyFormatter,
											owingItem.split.multiplicand
										),
										denominator: owingItem.split.denominator.toString(),
										numerator: owingItem.split.numerator.toString()
									}
								)}
							</span>
							<span class={isVoid ? 'numeric void' : 'numeric'}>
								{getNumericDisplay(currencyFormatter, owingItem.cost)}
							</span>
						{/each}
						<hr class="divider" />
						<span class="disabled">{strings['subtotal']}</span>
						<span class="disabled"></span>
						<span>{getNumericDisplay(currencyFormatter, contribution.owing.total)}</span>
					</article>
					<article class="summary balance">
						<span class="disabled">
							{strings['balance']}
						</span>
						<span class="disabled numeric">
							{interpolateString(strings['balanceCalculation{subtrahend}{minuend}'], {
								subtrahend: getNumericDisplay(currencyFormatter, contribution.paid.total),
								minuend: getNumericDisplay(currencyFormatter, contribution.owing.total)
							})}
						</span>
						<span class="numeric">
							{getNumericDisplay(
								currencyFormatter,
								contribution.paid.total - contribution.owing.total
							)}
						</span>
					</article>
				{/if}
			</section>
		</div>
	{/if}
</dialog>

<style>
	@media screen and (max-width: 768px) {
		#summaryDialog {
			height: 100vh;
			margin: 0;
			max-height: unset;
			max-width: unset;
			padding: 0;
			width: 100vw;
		}
	}

	@media screen and (min-width: 768px) {
		#summaryDialog {
			background:
				linear-gradient(135deg, transparent 8px, var(--color-background-secondary) 8.01px) top left,
				linear-gradient(45deg, var(--color-background-secondary) 4px, transparent 4.01px) top left,
				linear-gradient(135deg, var(--color-background-secondary) 4px, transparent 4.01px) bottom
					left,
				linear-gradient(45deg, transparent 8px, var(--color-background-secondary) 8.01px) bottom
					left;
			background-size: 12px 6px;
			background-repeat: repeat-x;
			bottom: 0;
			left: 0;
			margin: auto;
			padding: 6px 0;
			right: 0;
			top: 0;
		}
	}

	#summaryDialog {
		border: 0;
		color: currentColor;

		&::backdrop {
			background-color: var(--color-background-backdrop);
		}
	}

	.content {
		background-color: var(--color-background-secondary);
		min-height: 100%;
	}

	.summaries {
		display: flex;
		flex-direction: column;
		gap: var(--length-spacing);
		padding: var(--length-spacing);
	}

	.summary {
		background-color: var(--color-background-surface);
		backdrop-filter: blur(var(--length-surface-blur));
		border-radius: var(--length-radius);
		display: grid;
		font-family: JetBrains Mono;
		gap: var(--length-spacing);
		padding: var(--length-spacing);

		&.balance,
		&.owing {
			grid-template-columns: 1fr max-content max-content;
		}

		&.paid {
			grid-template-columns: 1fr max-content;
		}

		.disabled {
			color: var(--color-font-disabled);
		}

		.divider {
			border: 0;
			border-top: var(--length-divider) dashed var(--color-divider);
			grid-column: 1 / -1;
		}

		.numeric {
			text-align: right;
		}

		.void {
			color: var(--color-font-inactive);
		}
	}

	.title {
		align-items: center;
		border-bottom: var(--length-divider) solid var(--color-divider);
		display: flex;
		gap: var(--length-spacing);
		justify-content: space-between;
		padding: var(--length-spacing);
	}
</style>
