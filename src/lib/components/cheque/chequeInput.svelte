<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	import {
		CURRENCY_MAX,
		CURRENCY_MIN,
		getNumericDisplay,
		parseNumericFormat
	} from '$lib/utils/common/parseNumeric';
	let {
		formatter,
		isAlternate,
		isHeading,
		value = $bindable(''),
		...props
	}: {
		formatter?: Intl.NumberFormat;
		isAlternate?: boolean;
		isHeading?: boolean;
	} & HTMLInputAttributes = $props();

	let displayValue = $state(value);
	if (formatter) {
		displayValue = getNumericDisplay(formatter, value);
	}
	let width = $derived(`calc(${displayValue.toString().length}ch + (var(--length-spacing) * 2))`);
	const classes: string[] = [];
	if (isAlternate) {
		classes.push('alternate');
	}
	if (isHeading) {
		classes.push('header');
	}
	if (formatter) {
		classes.push('numeric');

		if (parseNumericFormat(formatter, value.toString()) === 0) {
			classes.push('empty');
		}
	}
</script>

<input
	bind:value={displayValue}
	class={classes.join(' ')}
	onblur={(e) => {
		if (formatter) {
			const newValue = parseNumericFormat(
				formatter,
				e.currentTarget.value,
				CURRENCY_MIN,
				CURRENCY_MAX
			);
			displayValue = formatter.format(newValue);

			if (newValue === 0) {
				e.currentTarget.classList.add('empty');
			} else {
				e.currentTarget.classList.remove('empty');
			}
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
		transition: ease background-color 75ms;
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

		&.empty {
			color: var(--color-font-disabled);
		}

		&.header {
			border-bottom: var(--length-divider) solid var(--color-divider);
		}

		&.numeric {
			text-align: right;
		}
	}
</style>
