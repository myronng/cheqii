<script lang="ts">
	import type { ChequeData } from '$src/app';
	import ChequeInput from '$src/lib/components/cheque/chequeInput.svelte';
	import ChequeSelect from '$src/lib/components/cheque/chequeSelect.svelte';
	import Button from '$src/lib/components/common/buttons/button.svelte';
	import AddCircle from '$src/lib/components/common/icons/addCircle.svelte';
	import AddUser from '$src/lib/components/common/icons/addUser.svelte';
	import { getNumericDisplay } from '$src/lib/utils/common/parseNumeric';
	import { allocate } from '$src/lib/utils/common/allocate';

	let { chequeData }: { chequeData: ChequeData } = $props();

	const currencyFormatter = new Intl.NumberFormat('en-CA', {
		currency: 'CAD',
		currencyDisplay: 'narrowSymbol',
		style: 'currency'
	});
	const integerFormatter = new Intl.NumberFormat('en-CA', {
		maximumFractionDigits: 0,
		minimumFractionDigits: 0,
		style: 'decimal'
	});

	const allocateResults = allocate(chequeData.items, chequeData.contributors);

	let contributions = $state(allocateResults.contributions);
	let grandTotal = $state(allocateResults.grandTotal);
</script>

<section
	class="content"
	style:grid-template-columns={`1fr repeat(${2 + chequeData.contributors.length}, min-content)`}
>
	<div class="heading text">Item</div>
	<div class="heading text">Cost</div>
	<div class="heading text">Buyer</div>
	{#each chequeData.contributors as contributor}
		<ChequeInput isHeader value={contributor.name} />
	{/each}
	{#each chequeData.items as item, index}
		{@const isAlternate = index % 2 !== 0}
		<ChequeInput {isAlternate} value={item.name} />
		<ChequeInput
			formatter={currencyFormatter}
			inputmode="decimal"
			{isAlternate}
			type="number"
			value={item.cost}
		/>
		<ChequeSelect
			{isAlternate}
			options={chequeData.contributors}
			value={chequeData.contributors[item.buyer].id}
		/>
		{#each item.split.contributors as split}
			<ChequeInput
				formatter={integerFormatter}
				inputmode="numeric"
				{isAlternate}
				type="number"
				value={split}
			/>
		{/each}
	{/each}
	<div class="actions">
		<div class="scroller">
			<Button><AddCircle height="1em" stroke-width="2.5" width="1em" />Add Item</Button>
			<Button><AddUser height="1em" stroke-width="2.5" width="1em" />Add Contributor</Button>
		</div>
	</div>
	<div class="grand total">
		<div class="label">Cheque Total</div>
		<div class="value">{getNumericDisplay(currencyFormatter, grandTotal)}</div>
	</div>
	<div class="text total">
		<span>Paid</span>
		<span>Owing</span>
		<span>Balance</span>
	</div>
	{#each contributions as [_index, contribution]}
		<button class="total numeric">
			<span>{getNumericDisplay(currencyFormatter, contribution.paid)}</span>
			<span>{getNumericDisplay(currencyFormatter, contribution.owing)}</span>
			<span>{getNumericDisplay(currencyFormatter, contribution.paid - contribution.owing)}</span>
		</button>
	{/each}
</section>

<style>
	.actions {
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
