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
	import { getNumericDisplay } from '$lib/utils/common/parseNumeric';

	let {
		allocations,
		chequeData: data,
		currencyFormatter,
		onAllocate,
		strings
	}: {
		allocations: Allocations;
		chequeData: ChequeData;
		currencyFormatter: Intl.NumberFormat;
		onAllocate: (allocations: Allocations) => void;
		strings: LocalizedStrings;
	} = $props();

	let chequeData = $state(data);
	let selectedCoordinates: { x: number; y: number } | null = $state(null);

	const integerFormatter = new Intl.NumberFormat('en-CA', {
		maximumFractionDigits: 0,
		minimumFractionDigits: 0,
		style: 'decimal'
	});
	const factor = Math.pow(10, currencyFormatter.resolvedOptions().maximumFractionDigits ?? 2);
</script>

<section
	class="content"
	onfocusout={() => {
		selectedCoordinates = null;
	}}
	style:grid-template-columns={`1fr repeat(${2 + chequeData.contributors.length}, min-content)`}
>
	<div class="heading text">{strings['item']}</div>
	<div class="heading text">{strings['cost']}</div>
	<div class="heading text">{strings['buyer']}</div>
	{#each chequeData.contributors as contributor, contributorIndex}
		<ChequeInput
			isHeading
			onchange={(e) => {
				chequeData.contributors[contributorIndex].name = e.currentTarget.value;
			}}
			onfocus={() => {
				selectedCoordinates = { x: 3 + contributorIndex, y: 0 };
			}}
			value={contributor.name}
		/>
	{/each}
	{#each chequeData.items as item, itemIndex}
		{@const isAlternate = itemIndex % 2 !== 0}
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
			onchange={(e) => {
				chequeData.items[itemIndex].cost = Number(e.currentTarget.value) * factor;
				onAllocate(allocate(chequeData.items, chequeData.contributors));
			}}
			onfocus={() => {
				selectedCoordinates = { x: 1, y: selectedItemIndex };
			}}
			value={item.cost}
		/>
		<ChequeSelect
			{isAlternate}
			onchange={(e) => {
				chequeData.items[itemIndex].buyer = e.currentTarget.selectedIndex;
				onAllocate(allocate(chequeData.items, chequeData.contributors));
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
				onchange={(e) => {
					item.split[splitIndex] = Number(e.currentTarget.value);
					onAllocate(allocate(chequeData.items, chequeData.contributors));
				}}
				onfocus={() => {
					selectedCoordinates = { x: 3 + splitIndex, y: selectedItemIndex };
				}}
				value={split}
			/>
		{/each}
	{/each}
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
				<AddCircle />{strings['addItem']}
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
					onAllocate(allocate(chequeData.items, chequeData.contributors));
				}}
			>
				<AddUser />{strings['addContributor']}
			</Button>
			{#if selectedCoordinates !== null}
				{#if selectedCoordinates.y > 0}
					<Button color="error">
						<MinusCircle />{interpolateString(strings['remove{item}'], {
							item: chequeData.items[selectedCoordinates.y - 1].name
						})}
					</Button>
				{/if}
				{#if selectedCoordinates.x > 2}
					<Button color="error">
						<MinusUser />{interpolateString(strings['remove{item}'], {
							item: chequeData.contributors[selectedCoordinates.x - 3].name
						})}
					</Button>
				{/if}
			{/if}
		</div>
	</div>
	<div class="grand total">
		<div class="label">{strings['chequeTotal']}</div>
		<div class="value">{getNumericDisplay(currencyFormatter, allocations.grandTotal)}</div>
	</div>
	<div class="text total">
		<span>{strings['paid']}</span>
		<span>{strings['owing']}</span>
		<span>{strings['balance']}</span>
	</div>
	{#each allocations.contributions as contributionArray}
		{@const contribution = contributionArray[1]}
		<button class="total numeric">
			<span>{getNumericDisplay(currencyFormatter, contribution.paid)}</span>
			<span>{getNumericDisplay(currencyFormatter, contribution.owing)}</span>
			<span>{getNumericDisplay(currencyFormatter, contribution.paid - contribution.owing)}</span>
		</button>
	{/each}
</section>

<style>
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
			max-width: 100vw;
			position: sticky;
			white-space: nowrap;
			width: 100%;
		}
	}

	.content {
		display: grid;
		font-family: JetBrains Mono;
		margin: 0 auto;
		position: relative;
	}

	.heading {
		border-bottom: var(--length-divider) solid var(--color-divider);
		padding: calc(var(--length-spacing) * 0.5) var(--length-spacing);
	}

	.text {
		color: var(--color-font-disabled);
	}

	.total {
		background-color: transparent;
		border: 0;
		display: flex;
		flex-direction: column;
		font: inherit;
		gap: var(--length-spacing);
		height: 100%;
		justify-content: center;
		padding: var(--length-spacing);

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
