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
	style:min-inline-size={value
		? `calc(${value.toString().length}ch + (var(--length-spacing) * 2))`
		: `calc(${(props.placeholder ?? '').toString().length}ch + (var(--length-spacing) * 2))`}
	style:text-align={formatter ? 'end' : 'start'}
	{value}
	{...props}
/>

<style>
	input {
		background-color: var(--color-background-secondary);
		border: none;
		flex-basis: 0;
		font: inherit;
		inline-size: 100%;
		outline-offset: calc(var(--length-divider) * -1);
		padding-block: calc(var(--length-spacing) * 0.5);
		padding-inline: var(--length-spacing);

		@media (prefers-reduced-motion: no-preference) {
			transition: ease background-color 75ms;
		}

		&:hover:not(:focus-within) {
			background-color: var(--color-background-hover);
		}

		&:focus-within {
			background-color: var(--color-background-active);
			outline: var(--length-divider) solid var(--color-primary);

			&::placeholder {
				color: var(--color-font-disabled);
			}
		}

		&::placeholder {
			color: currentColor;
		}
	}
</style>
