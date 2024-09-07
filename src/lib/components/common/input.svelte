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
		padding: var(--length-spacing) calc(var(--length-spacing) * 2);

		&:hover:not(:focus-within) {
			border-color: var(--color-divider-hover);
		}

		&:focus-within {
			border-color: var(--color-primary);
		}

		&::placeholder {
			color: var(--color-font-disabled);
		}
	}
</style>
