<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	import { parseNumericFormat } from '$lib/utils/common/parseNumeric';
	let {
		formatter,
		isAlternate,
		onblur,
		onchange,
		onfocus,
		value = '',
		...props
	}: {
		formatter?: Intl.NumberFormat;
		isAlternate?: boolean;
	} & HTMLInputAttributes = $props();

	const min = Number(props.min);
	const max = Number(props.max);
</script>

<input
	onblur={(e) => {
		if (formatter) {
			e.currentTarget.value = formatter.format(
				parseNumericFormat(formatter, e.currentTarget.value, min, max)
			);
		}
		onblur?.(e);
	}}
	onchange={(e) => {
		if (formatter) {
			const newValue = parseNumericFormat(formatter, e.currentTarget.value, min, max);
			e.currentTarget.value = newValue.toString();
		}
		onchange?.(e);
	}}
	onfocus={(e) => {
		const target = e.currentTarget;
		if (formatter) {
			e.currentTarget.value = parseNumericFormat(formatter, target.value, min, max).toString();
		}
		onfocus?.(e);
		requestAnimationFrame(() => {
			target.select();
		});
	}}
	style:--color-background-secondary={isAlternate ? undefined : 'transparent'}
	style:color={formatter && parseNumericFormat(formatter, value.toString(), min, max) === 0
		? 'var(--color-font-inactive)'
		: 'currentColor'}
	style:min-width={`calc(${value.toString().length}ch + (var(--length-spacing) * 2))`}
	style:text-align={formatter ? 'right' : 'left'}
	{value}
	{...props}
/>

<style>
	input {
		background-color: var(--color-background-secondary);
		border: none;
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

		&::placeholder {
			color: var(--color-font-disabled);
		}
	}
</style>
