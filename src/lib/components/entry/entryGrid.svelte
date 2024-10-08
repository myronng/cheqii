<script lang="ts">
	import type { Allocations } from '$lib/utils/common/allocate';
	import type { ChequeData, OnChequeChange } from '$lib/utils/common/cheque.svelte';
	import type { OnUserChange, User } from '$lib/utils/common/user.svelte';

	import Button from '$lib/components/common/buttons/button.svelte';
	import AddCircle from '$lib/components/common/icons/addCircle.svelte';
	import AddUser from '$lib/components/common/icons/addUser.svelte';
	import MinusCircle from '$lib/components/common/icons/minusCircle.svelte';
	import MinusUser from '$lib/components/common/icons/minusUser.svelte';
	import EntryInput from '$lib/components/entry/entryInput.svelte';
	import EntrySelect from '$lib/components/entry/entrySelect.svelte';
	import {
		CURRENCY_MAX,
		CURRENCY_MIN,
		getNumericDisplay,
		INTEGER_FORMATTER,
		parseNumericFormat,
		SPLIT_MAX,
		SPLIT_MIN
	} from '$lib/utils/common/formatter';
	import { interpolateString, type LocalizedStrings } from '$lib/utils/common/locale';

	let {
		allocations,
		chequeData = $bindable(),
		contributorSummaryIndex = $bindable(),
		currencyFactor,
		currencyFormatter,
		onChequeChange,
		onUserChange,
		strings,
		userId
	}: {
		allocations: Allocations;
		chequeData: ChequeData;
		contributorSummaryIndex: number;
		currencyFactor: number;
		currencyFormatter: Intl.NumberFormat;
		onChequeChange: OnChequeChange;
		onUserChange: OnUserChange;
		strings: LocalizedStrings;
		userId: User['id'];
	} = $props();

	let selectedCoordinates: { x: number; y: number } | null = $state(null);
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
				<EntryInput
					alignment="end"
					onchange={async (e) => {
						const selectedContributor = chequeData.contributors[contributorIndex];
						selectedContributor.name = e.currentTarget.value;
						const transactions: Promise<void>[] = [];
						transactions.push(onChequeChange(chequeData));

						if (selectedContributor.id === userId) {
							transactions.push(onUserChange({ name: selectedContributor.name }));
						}

						await Promise.all(transactions);
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
				<EntryInput
					{isAlternate}
					onchange={async (e) => {
						chequeData.items[itemIndex].name = e.currentTarget.value;
						await onChequeChange(chequeData);
					}}
					onfocus={() => {
						selectedCoordinates = { x: 0, y: selectedItemIndex };
					}}
					title={interpolateString(strings['item{index}'], { index: selectedItemIndex.toString() })}
					value={item.name}
				/>
				<EntryInput
					formatter={currencyFormatter}
					inputmode="decimal"
					{isAlternate}
					max={CURRENCY_MAX}
					min={CURRENCY_MIN}
					onchange={async (e) => {
						chequeData.items[itemIndex].cost = Number(e.currentTarget.value) * currencyFactor;
						await onChequeChange(chequeData);
					}}
					onfocus={() => {
						selectedCoordinates = { x: 1, y: selectedItemIndex };
					}}
					title={interpolateString(strings['{item}Cost'], { item: item.name })}
					value={getNumericDisplay(
						currencyFormatter,
						parseNumericFormat(currencyFormatter, item.cost.toString(), CURRENCY_MIN, CURRENCY_MAX)
					)}
				/>
				<EntrySelect
					{isAlternate}
					onchange={async (e) => {
						chequeData.items[itemIndex].buyer = e.currentTarget.selectedIndex;
						await onChequeChange(chequeData);
					}}
					onfocus={() => {
						selectedCoordinates = { x: 2, y: selectedItemIndex };
					}}
					options={chequeData.contributors}
					title={interpolateString(strings['{item}Buyer'], { item: item.name })}
					value={chequeData.contributors[item.buyer].id}
				/>
				{#each item.split as split, splitIndex}
					<EntryInput
						formatter={INTEGER_FORMATTER}
						inputmode="numeric"
						{isAlternate}
						max={SPLIT_MAX}
						min={SPLIT_MIN}
						onchange={async (e) => {
							item.split[splitIndex] = Number(e.currentTarget.value);
							await onChequeChange(chequeData);
						}}
						onfocus={() => {
							selectedCoordinates = { x: 3 + splitIndex, y: selectedItemIndex };
						}}
						title={interpolateString(strings['{item}ContributionFrom{contributor}'], {
							contributor: chequeData.contributors[splitIndex].name,
							item: item.name
						})}
						value={getNumericDisplay(
							INTEGER_FORMATTER,
							parseNumericFormat(currencyFormatter, split.toString(), SPLIT_MIN, SPLIT_MAX)
						)}
					/>
				{/each}
			{/each}
		</div>
		<div class="actions">
			<div class="scroller">
				<Button
					onclick={async () => {
						chequeData.items.push({
							buyer: 0,
							cost: 0,
							name: interpolateString(strings['item{index}'], {
								index: String(chequeData.items.length + 1)
							}),
							split: chequeData.contributors.map(() => 0)
						});
						await onChequeChange(chequeData);
					}}
				>
					<AddCircle />
					<span class="hideMobile">
						{strings['addItem']}
					</span>
				</Button>
				<Button
					onclick={async () => {
						chequeData.contributors.push({
							id: crypto.randomUUID(),
							name: interpolateString(strings['contributor{index}'], {
								index: String(chequeData.contributors.length + 1)
							})
						});
						chequeData.items.forEach((item) => {
							item.split.push(0);
						});
						await onChequeChange(chequeData);
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
							onclick={async () => {
								if (selectedCoordinates) {
									chequeData.items.splice(selectedCoordinates.y - 1, 1);
									selectedCoordinates = null;
									await onChequeChange(chequeData);
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
							onclick={async () => {
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
									await onChequeChange(chequeData);
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
				<div class="label">{strings['total']}</div>
				<div class="value">{getNumericDisplay(currencyFormatter, allocations.grandTotal)}</div>
			</div>
			<div class="text total">
				<span>{strings['paid']}</span>
				<span>{strings['owing']}</span>
				<span>{strings['balance']}</span>
			</div>
			{#each allocations.contributions as [index, contribution]}
				{@const balance = contribution.paid.total - contribution.owing.total}
				<button
					class="total numeric"
					onclick={() => {
						(document.getElementById('summaryDialog') as HTMLDialogElement).showModal();
						contributorSummaryIndex = index;
					}}
				>
					<span>{getNumericDisplay(currencyFormatter, contribution.paid.total)}</span>
					<span>{getNumericDisplay(currencyFormatter, contribution.owing.total)}</span>
					<span class={balance < 0 ? 'negative' : undefined}>
						{getNumericDisplay(currencyFormatter, balance)}
					</span>
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
		top: 0;
		grid-column: 1 / -1;

		.scroller {
			display: flex;
			font: 1rem Comfortaa;
			gap: calc(var(--length-spacing) * 2);
			inline-size: 100%;
			justify-content: center;
			left: 0;
			max-inline-size: 100cqw;
			position: sticky;
			right: 0;
		}
	}

	.content {
		display: grid;
		grid-column: full;
		grid-template-columns: subgrid;
		font-family: JetBrains Mono;
		margin-block: 0;
		margin-inline: auto;
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
		padding-block: calc(var(--length-spacing) * 0.5);
		padding-inline: var(--length-spacing);

		&.numeric {
			text-align: end;
		}
	}

	.totals {
		display: grid;
		grid-column: content;
		grid-template-columns: subgrid;
		white-space: nowrap;
	}

	.text {
		color: var(--color-font-disabled);
	}

	.total {
		block-size: 100%;
		border: 0;
		display: flex;
		flex-direction: column;
		font: inherit;
		gap: var(--length-spacing);
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

			@media (prefers-reduced-motion: no-preference) {
				transition: ease background-color 75ms;
			}

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

		& .negative {
			color: var(--color-error);
		}

		& .value {
			font-size: 1.75rem;
		}
	}
</style>
