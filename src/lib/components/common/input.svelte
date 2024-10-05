<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let { value = $bindable(), ...props }: HTMLInputAttributes = $props();
</script>

<input bind:value type="text" {...props} />

<style>
	input {
		background-color: transparent;
		border: var(--length-divider) solid var(--color-divider);
		border-radius: 100vw;
		color: currentColor;
		font: inherit;
		outline: 0;
		padding-block: var(--length-spacing);
		padding-inline: calc(var(--length-spacing) * 2);
		inline-size: 100%;

		&:hover:not(:focus-within),
		&:hover:read-only,
		&:focus-within:read-only {
			border-color: var(--color-divider-hover);
		}

		&:focus-within:not(:read-only) {
			border-color: var(--color-primary);
		}

		&::placeholder {
			color: var(--color-font-disabled);
		}
	}
</style>
