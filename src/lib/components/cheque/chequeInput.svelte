<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	let {
		isHeader,
		type,
		value = $bindable(),
		...props
	}: { isHeader?: boolean } & HTMLInputAttributes = $props();
	let width = $derived(`calc(${value.toString().length}ch + (var(--length-spacing) * 2))`);
</script>

<input
	bind:value
	style:min-width={width}
	style:border-bottom={isHeader ? 'var(--length-divider) solid var(--color-divider)' : ''}
	{type}
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

		&[type='number'] {
			appearance: textfield;
			text-align: right;

			&::-webkit-inner-spin-button,
			&::-webkit-outer-spin-button {
				-webkit-appearance: none;
				margin: 0;
			}
		}
	}
</style>
