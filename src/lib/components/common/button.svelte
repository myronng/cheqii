<script lang="ts">
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	const { children, ...props }: HTMLAnchorAttributes | HTMLButtonAttributes = $props();

	function isAnchorProps(
		props: HTMLAnchorAttributes | HTMLButtonAttributes
	): props is HTMLAnchorAttributes {
		return 'href' in props ? true : false;
	}
	function isButtonProps(
		props: HTMLAnchorAttributes | HTMLButtonAttributes
	): props is HTMLButtonAttributes {
		return 'href' in props ? false : true;
	}
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
			background-color: var(--color-secondary);
		}
	}
</style>
