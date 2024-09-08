<script lang="ts">
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	import { isAnchorProps, isButtonProps } from '$lib/utils/common/button';

	let {
		children,
		scale = 1,
		...props
	}: { scale?: number } & (HTMLAnchorAttributes | HTMLButtonAttributes) = $props();
</script>

{#if isAnchorProps(props)}
	<a style:--scale={scale} {...props}>
		{@render children?.()}
	</a>
{:else if isButtonProps(props)}
	<button style:--scale={scale} {...props}>
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
		font-weight: 700;
		gap: var(--length-spacing);
		justify-content: center;
		padding: calc(var(--length-spacing) * var(--scale))
			calc(var(--length-spacing) * 2 * var(--scale));
		text-decoration: none;
		transition: ease background-color 75ms;

		&:active {
			background-color: var(--color-background-active);
		}

		&:hover:not(:active) {
			background-color: var(--color-background-hover);
		}
	}
</style>
