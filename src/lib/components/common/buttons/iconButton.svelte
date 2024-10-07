<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	const { children, ...props }: HTMLButtonAttributes = $props();
</script>

<button {...props}>
	{@render children?.()}
</button>

<style>
	button {
		align-items: center;
		background-color: transparent;
		border: 0;
		border-radius: 50%;
		color: var(--color-primary);
		cursor: pointer;
		display: flex;
		font-size: 32px;
		justify-content: center;
		padding: var(--length-spacing);

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
