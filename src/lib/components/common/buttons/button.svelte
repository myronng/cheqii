<script lang="ts">
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { isAnchorProps, isButtonProps } from '$lib/services/common/button';

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
		background-color: var(--color-primary);
		border: var(--length-divider) solid var(--color-divider);
		border-radius: var(--length-radius);
		color: var(--color-font-secondary);
		cursor: pointer;
		display: flex;
		justify-content: center;
		padding: calc(var(--length-spacing) * 2) calc(var(--length-spacing) * 4);
		text-decoration: none;
		transition: ease background-color 0.15s;

		&:active {
			background-color: color-mix(in srgb, var(--color-primary) 80%, rgb(0 0 0) 20%);
		}

		&:hover:not(:active) {
			background-color: color-mix(in srgb, var(--color-primary) 90%, rgb(0 0 0) 10%);
		}
	}
</style>
