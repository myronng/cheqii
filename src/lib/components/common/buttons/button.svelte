<script lang="ts">
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { isAnchorProps, isButtonProps } from '$lib/utils/common/button';

	const { children, ...props }: HTMLAnchorAttributes | HTMLButtonAttributes = $props();
</script>

{#if isAnchorProps(props)}
	<a {...props}>
		{@render children?.()}
	</a>
{:else if isButtonProps(props)}
	<button {...props}>
		{@render children?.()}
	</button>
{/if}

<style>
	a,
	button {
		background-color: transparent;
		border: var(--length-divider) solid var(--color-primary);
		border-radius: 100vw;
		color: var(--color-primary);
		cursor: pointer;
		display: flex;
		font: inherit;
		justify-content: center;
		padding: var(--length-spacing) calc(var(--length-spacing) * 2);
		text-decoration: none;
		transition: ease background-color 0.15s;

		&:active {
			background-color: var(--color-background-active);
		}

		&:hover:not(:active) {
			background-color: var(--color-background-hover);
		}
	}
</style>
