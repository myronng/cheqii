<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { CURRENCY_MAX, CURRENCY_MIN, parseNumericFormat } from '$lib/utils/common/parseNumeric';
	let {
		formatter,
		isAlternate,
		isHeader,
		type,
		value,
		...props
	}: {
		formatter?: Intl.NumberFormat;
		isAlternate?: boolean;
		isHeader?: boolean;
	} & HTMLInputAttributes = $props();

	let displayValue = $state(value);
	if (formatter) {
		const decimals = formatter.resolvedOptions().maximumFractionDigits ?? 2;
		displayValue = formatter.format(value / Math.pow(10, decimals));
	}
	let width = $derived(`calc(${displayValue.toString().length}ch + (var(--length-spacing) * 2))`);
	let className = $state('');
	if (isAlternate) {
		className += ' alternate';
	}
	if (isHeader) {
		className += ' header';
	}
	if (formatter) {
		className += ' numeric';
	}
</script>

<input
	bind:value={displayValue}
	class={className}
	onblur={(e) => {
		if (formatter) {
			displayValue = formatter.format(
				parseNumericFormat(formatter, e.currentTarget.value, CURRENCY_MIN, CURRENCY_MAX)
			);
		}
	}}
	onfocus={(e) => {
		const target = e.currentTarget;
		if (formatter) {
			displayValue = parseNumericFormat(formatter, target.value);
		}
		setTimeout(() => {
			target.select();
		}, 0);
	}}
	style:min-width={width}
	{...props}
/>

<style>
	input {
		background-color: transparent;
		border: none;
		color: currentColor;
		font: inherit;
		outline-offset: calc(var(--length-divider) * -1);
		padding: calc(var(--length-spacing) * 0.5) var(--length-spacing);
		transition: ease background-color 0.15s;
		width: 100%;

		&:hover:not(:focus-within) {
			background-color: var(--color-background-hover);
		}

		&:focus-within {
			background-color: var(--color-background-active);
			outline: var(--length-divider) solid var(--color-primary);
		}

		&.alternate:not(:hover):not(:focus-within) {
			background-color: var(--color-background-alternate);
		}

		&.header {
			border-bottom: var(--length-divider) solid var(--color-divider);
		}

		&.numeric {
			text-align: right;
		}
	}
</style>
