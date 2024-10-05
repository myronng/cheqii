<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	const { children, ...props }: HTMLAnchorAttributes = $props();
</script>

<a {...props}>
	{@render children?.()}
</a>

<style>
	a {
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
		text-decoration: none;

		@media (prefers-reduced-motion: no-preference) {
			transition: ease background-color 75ms;
		}

		&:active {
			background-color: var(--color-background-active);
		}

		&:hover:not(:active) {
			background-color: var(--color-background-hover);
		}
	}
</style>
