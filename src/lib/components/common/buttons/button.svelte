<script lang="ts">
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	import { isAnchorProps, isButtonProps } from '$lib/utils/common/button';

	let {
		borderless = false,
		children,
		padding = 1,
		...props
	}: { borderless?: boolean; padding?: number } & (
		| HTMLAnchorAttributes
		| HTMLButtonAttributes
	) = $props();
</script>

{#if isAnchorProps(props)}
	<a class={borderless ? 'borderless' : undefined} style:--padding={padding} {...props}>
		{@render children?.()}
	</a>
{:else if isButtonProps(props)}
	<button class={borderless ? 'borderless' : undefined} style:--padding={padding} {...props}>
		{@render children?.()}
	</button>
{/if}

<style>
	a,
	button {
		align-items: center;
		background-color: transparent;
		border-radius: 100vw;
		color: var(--color-primary);
		cursor: pointer;
		display: flex;
		font: inherit;
		font-weight: 700;
		gap: var(--length-spacing);
		justify-content: center;
		padding: calc(var(--length-spacing) * var(--padding))
			calc(var(--length-spacing) * 2 * var(--padding));
		text-decoration: none;
		transition: ease background-color 75ms;

		&:active {
			background-color: var(--color-background-active);
		}

		&:hover:not(:active) {
			background-color: var(--color-background-hover);
		}

		&:not(.borderless) {
			border: var(--length-divider) solid var(--color-primary);
		}

		&.borderless {
			border: 0;
		}
	}
</style>
