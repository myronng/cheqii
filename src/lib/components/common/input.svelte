<script lang="ts">
	let { placeholder = '', value = $bindable('') } = $props();
</script>

<input bind:value {placeholder} type="text" />

<style>
	input {
		background-color: transparent;
		border: var(--length-divider) solid var(--color-divider);
		border-radius: var(--length-radius);
		color: currentColor;
		font: inherit;
		outline: 0;
		padding: var(--length-spacing);

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
