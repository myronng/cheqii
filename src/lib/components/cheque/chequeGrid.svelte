<script lang="ts">
	import type { ChequeData } from '$lib/types/cheque';
	import { allocate, type Allocations } from '$lib/utils/common/allocate';
	import { interpolateString, type LocalizedStrings } from '$lib/utils/common/locale';

	import ChequeInput from '$lib/components/cheque/chequeInput.svelte';
	import ChequeSelect from '$lib/components/cheque/chequeSelect.svelte';
	import Button from '$lib/components/common/buttons/button.svelte';
	import AddCircle from '$lib/components/common/icons/addCircle.svelte';
	import AddUser from '$lib/components/common/icons/addUser.svelte';
	import MinusCircle from '$lib/components/common/icons/minusCircle.svelte';
	import MinusUser from '$lib/components/common/icons/minusUser.svelte';
	import {
		CURRENCY_MAX,
		CURRENCY_MIN,
		getNumericDisplay,
		parseNumericFormat,
		SPLIT_MAX,
		SPLIT_MIN
	} from '$lib/utils/common/parseNumeric';

	let {
		allocations = $bindable(),
		chequeData = $bindable(),
		contributorSummaryIndex = $bindable(),
		currencyFormatter,
		strings
	}: {
		allocations: Allocations;
		chequeData: ChequeData;
		contributorSummaryIndex: number;
		currencyFormatter: Intl.NumberFormat;
		strings: LocalizedStrings;
	} = $props();

	let selectedCoordinates: { x: number; y: number } | null = $state(null);

	const integerFormatter = new Intl.NumberFormat('en-CA', {
		maximumFractionDigits: 0,
		minimumFractionDigits: 0,
		style: 'decimal'
	});
	const factor = Math.pow(10, currencyFormatter.resolvedOptions().maximumFractionDigits ?? 2);
</script>

<div class="grid">
	<section
		class="content"
		onfocusout={(e) => {
			const target = e.relatedTarget;
			if (target instanceof HTMLElement) {
				const selectedActions = target.closest('.actions');
				if (!selectedActions) {
					selectedCoordinates = null;
				}
			} else {
				selectedCoordinates = null;
			}
		}}
	>
		<div class="entry">
			<div class="heading text">{strings['item']}</div>
			<div class="heading numeric text">{strings['cost']}</div>
			<div class="heading text">{strings['buyer']}</div>
			{#each chequeData.contributors as contributor, contributorIndex}
				<ChequeInput
					onblur={(e) => {
						chequeData.contributors[contributorIndex].name = e.currentTarget.value;
					}}
					onfocus={() => {
						selectedCoordinates = { x: 3 + contributorIndex, y: 0 };
					}}
					value={contributor.name}
				/>
			{/each}
			{#each chequeData.items as item, itemIndex}
				{@const isAlternate = itemIndex % 2 === 0}
				{@const selectedItemIndex = itemIndex + 1}
				<ChequeInput
					{isAlternate}
					onchange={(e) => {
						chequeData.items[itemIndex].name = e.currentTarget.value;
					}}
					onfocus={() => {
						selectedCoordinates = { x: 0, y: selectedItemIndex };
					}}
					value={item.name}
				/>
				<ChequeInput
					formatter={currencyFormatter}
					inputmode="decimal"
					{isAlternate}
					max={CURRENCY_MAX}
					min={CURRENCY_MIN}
					onchange={(e) => {
						chequeData.items[itemIndex].cost = Number(e.currentTarget.value) * factor;
						allocations = allocate(chequeData.items, chequeData.contributors);
					}}
					onfocus={() => {
						selectedCoordinates = { x: 1, y: selectedItemIndex };
					}}
					value={getNumericDisplay(
						currencyFormatter,
						parseNumericFormat(currencyFormatter, item.cost.toString(), CURRENCY_MIN, CURRENCY_MAX)
					)}
				/>
				<ChequeSelect
					{isAlternate}
					onchange={(e) => {
						chequeData.items[itemIndex].buyer = e.currentTarget.selectedIndex;
						allocations = allocate(chequeData.items, chequeData.contributors);
					}}
					onfocus={() => {
						selectedCoordinates = { x: 2, y: selectedItemIndex };
					}}
					options={chequeData.contributors}
					value={chequeData.contributors[item.buyer].id}
				/>
				{#each item.split as split, splitIndex}
					<ChequeInput
						formatter={integerFormatter}
						inputmode="numeric"
						{isAlternate}
						max={SPLIT_MAX}
						min={SPLIT_MIN}
						onchange={(e) => {
							item.split[splitIndex] = Number(e.currentTarget.value);
							allocations = allocate(chequeData.items, chequeData.contributors);
						}}
						onfocus={() => {
							selectedCoordinates = { x: 3 + splitIndex, y: selectedItemIndex };
						}}
						value={getNumericDisplay(
							integerFormatter,
							parseNumericFormat(currencyFormatter, split.toString(), SPLIT_MIN, SPLIT_MAX)
						)}
					/>
				{/each}
			{/each}
		</div>
		<div class="actions">
			<div class="scroller">
				<Button
					onclick={() => {
						chequeData.items.push({
							buyer: 0,
							cost: 0,
							name: interpolateString(strings['item{index}'], {
								index: String(chequeData.items.length + 1)
							}),
							split: chequeData.contributors.map(() => 0)
						});
					}}
				>
					<AddCircle />
					<span class="hideMobile">
						{strings['addItem']}
					</span>
				</Button>
				<Button
					onclick={() => {
						chequeData.contributors.push({
							id: crypto.randomUUID(),
							name: interpolateString(strings['contributor{index}'], {
								index: String(chequeData.contributors.length + 1)
							})
						});
						chequeData.items.forEach((item) => {
							item.split.push(0);
						});
						allocations = allocate(chequeData.items, chequeData.contributors);
					}}
				>
					<AddUser />
					<span class="hideMobile">
						{strings['addContributor']}
					</span>
				</Button>
				{#if selectedCoordinates !== null}
					{#if selectedCoordinates.y > 0 && chequeData.items.length > 1}
						<Button
							color="error"
							onclick={() => {
								if (selectedCoordinates) {
									chequeData.items.splice(selectedCoordinates.y - 1, 1);
									selectedCoordinates = null;
									allocations = allocate(chequeData.items, chequeData.contributors);
								}
							}}
						>
							<MinusCircle />
							<span class="hideMobile">
								{interpolateString(strings['remove{item}'], {
									item: chequeData.items[selectedCoordinates.y - 1].name
								})}
							</span>
						</Button>
					{/if}
					{#if selectedCoordinates.x > 2 && chequeData.contributors.length > 1}
						<Button
							color="error"
							onclick={() => {
								if (selectedCoordinates) {
									const currentContributor = selectedCoordinates.x - 3;
									for (const item of chequeData.items) {
										if (item.buyer >= currentContributor - 1) {
											item.buyer = 0;
										}
										item.split.splice(currentContributor, 1);
									}
									chequeData.contributors.splice(currentContributor, 1);
									selectedCoordinates = null;
									allocations = allocate(chequeData.items, chequeData.contributors);
								}
							}}
						>
							<MinusUser />
							<span class="hideMobile">
								{interpolateString(strings['remove{item}'], {
									item: chequeData.contributors[selectedCoordinates.x - 3].name
								})}
							</span>
						</Button>
					{/if}
				{/if}
			</div>
		</div>
		<div class="totals">
			<div class="grand text total">
				<div class="label">{strings['chequeTotal']}</div>
				<div class="value">{getNumericDisplay(currencyFormatter, allocations.grandTotal)}</div>
			</div>
			<div class="text total">
				<span>{strings['paid']}</span>
				<span>{strings['owing']}</span>
				<span>{strings['balance']}</span>
			</div>
			{#each allocations.contributions as [index, contribution]}
				<button
					class="total numeric"
					onclick={() => {
						(document.getElementById('summaryDialog') as HTMLDialogElement).showModal();
						contributorSummaryIndex = index;
					}}
				>
					<span>{getNumericDisplay(currencyFormatter, contribution.paid.total)}</span>
					<span>{getNumericDisplay(currencyFormatter, contribution.owing.total)}</span>
					<span
						>{getNumericDisplay(
							currencyFormatter,
							contribution.paid.total - contribution.owing.total
						)}</span
					>
				</button>
			{/each}
		</div>
	</section>
</div>

<style>
	@media screen and (max-width: 768px) {
		.hideMobile {
			display: none;
		}
	}

	.actions {
		background-color: var(--color-background-primary);
		border-top: var(--length-divider) solid var(--color-divider);
		bottom: 0;
		padding: var(--length-spacing) 0;
		position: sticky;
		grid-column: 1 / -1;

		.scroller {
			display: flex;
			font: 1rem Comfortaa;
			gap: calc(var(--length-spacing) * 2);
			justify-content: center;
			left: 0;
			max-width: 100cqw;
			position: sticky;
			width: 100%;
		}
	}

	.content {
		display: grid;
		grid-column: full;
		grid-template-columns: subgrid;
		font-family: JetBrains Mono;
		margin: 0 auto;
		position: relative;
	}

	.entry {
		display: grid;
		grid-column: content;
		grid-template-columns: subgrid;
	}

	.grid {
		display: grid;
		grid-template-columns:
			[full-start] 1fr
			[content-start] var(--content) [content-end]
			1fr [full-end];
		grid-template-rows: max-content;
	}

	.heading {
		background-color: var(--color-divider);
		padding: calc(var(--length-spacing) * 0.5) var(--length-spacing);

		&.numeric {
			text-align: right;
		}
	}

	.totals {
		display: grid;
		grid-column: content;
		grid-template-columns: subgrid;
	}

	.text {
		color: var(--color-font-disabled);
	}

	.total {
		border: 0;
		display: flex;
		flex-direction: column;
		font: inherit;
		gap: var(--length-spacing);
		height: 100%;
		justify-content: center;
		padding: var(--length-spacing);

		&:not(.text) {
			background-color: transparent;
		}

		&.grand {
			align-items: center;
			grid-column: span 2;
		}

		&.numeric {
			align-items: flex-end;
			color: inherit;
			cursor: pointer;
			text-decoration: none;
			transition: ease background-color 75ms;

			&:active {
				background-color: var(--color-background-active);
			}

			&:hover:not(:active) {
				background-color: var(--color-background-hover);
			}
		}

		& .label {
			font-size: 1.25rem;
		}

		& .value {
			font-size: 1.75rem;
		}
	}
</style>
