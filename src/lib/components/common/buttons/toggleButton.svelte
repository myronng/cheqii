<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		children,
		padding = 1,
		...props
	}: {
		padding?: number;
	} & HTMLInputAttributes = $props();
</script>

<label style:--padding={padding}>
	<input type="radio" {...props} />
	{@render children?.()}
</label>

<style>
	label {
		align-items: center;
		background-color: transparent;
		border: var(--length-divider) solid var(--color-divider);
		border-radius: var(--length-radius);
		color: var(--color-primary);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		font: inherit;
		font-family: Comfortaa;
		font-weight: 700;
		gap: var(--length-spacing);
		justify-content: center;
		max-width: 300px;
		padding-block: calc(var(--length-spacing) * var(--padding));
		padding-inline: calc(var(--length-spacing) * 2 * var(--padding));
		text-decoration: none;

		@media (prefers-reduced-motion: no-preference) {
			transition: ease background-color 75ms;
		}

		&:active:not(:has(input:checked)) {
			background-color: var(--color-background-active);
		}

		&:hover:not(:active):not(:has(input:checked)) {
			background-color: var(--color-background-hover);
		}

		&:has(input:checked) {
			background-color: var(--color-background-active);
			border-color: var(--color-primary);
		}
	}

	input {
		appearance: none;
		display: none;
	}
</style>
