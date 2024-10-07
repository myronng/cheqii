<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	let { children, ...props }: HTMLAnchorAttributes = $props();
</script>

<a {...props}>
	{@render children?.()}
</a>

<style>
	a {
		align-items: center;
		background-color: transparent;
		border: 0;
		box-sizing: border-box;
		color: var(--color-primary);
		display: grid;
		font: inherit;
		font-family: Comfortaa;
		font-weight: 700;
		gap: var(--length-spacing);
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		padding: var(--length-spacing);
		text-align: start;
		text-decoration: none;

		@media (prefers-reduced-motion: no-preference) {
			transition: ease background-color 75ms;
		}

		&:disabled {
			color: var(--color-font-disabled);
			pointer-events: none;
		}

		&:not(:disabled) {
			cursor: pointer;

			&:active {
				background-color: var(--color-background-active);
			}

			&:hover:not(:active) {
				background-color: var(--color-background-hover);
			}
		}
	}
</style>
