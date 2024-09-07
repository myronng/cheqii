<script lang="ts">
	import type { Contributor } from '$src/app';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	let {
		isAlternate,
		options,
		...props
	}: { isAlternate?: boolean; options: Contributor[] } & HTMLSelectAttributes = $props();
</script>

<select class={isAlternate ? 'alternate' : ''} {...props}>
	{#each options as option}
		<option value={option.id}>{option.name}</option>
	{/each}
</select>

<style>
	select {
		appearance: none;
		background-color: transparent;
		border: none;
		color: currentColor;
		cursor: pointer;
		font: inherit;
		outline-offset: calc(var(--length-divider) * -1);
		padding: calc(var(--length-spacing) * 0.5) var(--length-spacing);
		transition: ease background-color 75ms;

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

		& option {
			background-color: var(--color-background-primary);
			border: 2px solid red;
		}
	}
</style>
