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
		transition: ease background-color 0.15s;

		&:active {
			background-color: var(--color-background-active);
		}

		&:hover:not(:active) {
			background-color: var(--color-background-hover);
		}
	}
</style>
