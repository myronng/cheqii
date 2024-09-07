<script lang="ts">
	import type { ChequeData } from '$src/app';
	import ChequeInput from '$src/lib/components/cheque/chequeInput.svelte';
	import ChequeSelect from '$src/lib/components/cheque/chequeSelect.svelte';
	import Button from '$src/lib/components/common/buttons/button.svelte';

	let { chequeData }: { chequeData: ChequeData } = $props();
</script>

<section
	class="content"
	style:grid-template-columns={`1fr repeat(${2 + chequeData.contributors.length}, min-content)`}
>
	<div class="cell heading text">Item</div>
	<div class="cell heading text">Cost</div>
	<div class="cell heading text">Buyer</div>
	{#each chequeData.contributors as contributor}
		<ChequeInput isHeader value={contributor.name} />
	{/each}
	{#each chequeData.items as item}
		<ChequeInput value={item.name} />
		<ChequeInput type="number" value={item.cost} />
		<ChequeSelect
			options={chequeData.contributors}
			value={chequeData.contributors[item.buyer].id}
		/>
		{#each item.split as split}
			<ChequeInput type="number" value={split} />
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

	:global(.cell) {
		appearance: none;
		background-color: transparent;
		border: none;
		color: currentColor;
		font: inherit;
		outline-offset: calc(var(--length-divider) * -1);
		padding: calc(var(--length-spacing) * 0.5) var(--length-spacing);
		transition: ease background-color 0.15s;

		:global(&:not(.text)) {
			:global(&:hover:not(:focus-within)) {
				background-color: var(--color-background-hover);
			}

			:global(&:focus-within) {
				background-color: var(--color-background-active);
				outline: var(--length-divider) solid var(--color-primary);
			}
		}

		:global(& option) {
			background-color: var(--color-background-primary);
			border: 2px solid red;
		}
	}

	.content {
		display: grid;
		font-family: JetBrains Mono;
		margin: 0 auto;
		position: relative;
	}

	:global(.heading) {
		border-bottom: var(--length-divider) solid var(--color-divider);
	}

	:global(.numeric) {
		text-align: right;
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
