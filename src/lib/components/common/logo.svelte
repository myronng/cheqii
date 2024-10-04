<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	let { hasTitle = true, strings }: { hasTitle?: boolean; strings: LocalizedStrings } = $props();
</script>

<a href="/" style:border-radius={hasTitle ? 'var(--length-radius)' : '50%'} title={strings['home']}>
	<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
		<circle cx="56" cy="128" r="26" />
		<line stroke-linecap="round" stroke-width="40" x1="88" x2="200" y1="180" y2="80" />
	</svg>
	{#if hasTitle}
		<h1>Cheqii</h1>
	{/if}
</a>

<style>
	a {
		align-items: center;
		border-radius: 50%;
		display: flex;
		gap: var(--length-spacing);
		text-decoration: none;

		circle {
			fill: var(--color-primary);
		}

		h1 {
			color: var(--color-primary);
			font-family: 'Comfortaa';
			font-size: 1.615rem;
			line-height: 1.25;
			margin: 0;
			padding: calc(var(--length-spacing) * 0.5);
		}

		line {
			stroke: var(--color-secondary);
		}

		svg {
			height: 48px;
			width: 48px;
		}
	}
</style>
