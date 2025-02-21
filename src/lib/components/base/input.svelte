<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let { onfocus, value = $bindable(), ...props }: HTMLInputAttributes = $props();
</script>

<input
	bind:value
	onfocus={(e) => {
		const target = e.currentTarget;
		onfocus?.(e);
		if (props.readonly) {
			requestAnimationFrame(() => {
				target.select();
			});
		}
	}}
	type="text"
	{...props}
/>

<style>
	input {
		background-color: transparent;
		border: var(--length-divider) solid var(--color-divider);
		border-radius: 100vw;
		color: currentColor;
		font: inherit;
		inline-size: 100%;
		outline: 0;
		padding-block: var(--length-spacing);
		padding-inline: calc(var(--length-spacing) * 2);

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
