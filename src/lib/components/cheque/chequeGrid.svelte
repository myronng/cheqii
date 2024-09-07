<script lang="ts">
	import type { ChequeData } from '$src/app';
	import ChequeInput from '$src/lib/components/cheque/chequeInput.svelte';
	import ChequeSelect from '$src/lib/components/cheque/chequeSelect.svelte';
	import Button from '$src/lib/components/common/buttons/button.svelte';

	let { chequeData }: { chequeData: ChequeData } = $props();
	// chequeData.items.reduce((acc, item) => {
	//   item.cost
	//   return acc;
	// }, []);
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
		<ChequeInput isAlternate={index % 2 !== 0} value={item.name} />
		<ChequeInput
			formatter={currencyFormatter}
			inputmode="decimal"
			isAlternate={index % 2 !== 0}
			type="number"
			value={item.cost}
		/>
		<ChequeSelect
			isAlternate={index % 2 !== 0}
			options={chequeData.contributors}
			value={chequeData.contributors[item.buyer].id}
		/>
		{#each item.split as split}
			<ChequeInput
				formatter={integerFormatter}
				inputmode="numeric"
				isAlternate={index % 2 !== 0}
				type="number"
				value={split}
			/>
		{/each}
	{/each}
	<div class="actions">
		<div class="scroller">
			<Button>Add Item</Button>
			<Button>Add Contributor</Button>
		</div>
	</div>
	<div class="grand total">
		<div class="label">Cheque Total</div>
		<div class="value">850</div>
	</div>
	<div class="text total">
		<span>Paid</span>
		<span>Owing</span>
		<span>Balance</span>
	</div>
	{#each chequeData.contributors as contributor}
		<a class="total numeric" href="#summary">
			<span>600</span>
			<span>425</span>
			<span>175</span>
		</a>
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
		display: flex;
		flex-direction: column;
		gap: var(--length-spacing);
		height: 100%;
		justify-content: center;
		padding: var(--length-spacing);

		&.grand {
			align-items: center;
			grid-column: span 2;
		}

		&.numeric {
			color: inherit;
			text-align: right;
			text-decoration: none;
			transition: ease background-color 0.15s;

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
