<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	let {
		children,
		variant,
		...props
	}: { variant?: 'adaptive' | 'button' | 'normal' } & SVGAttributes<SVGElement> = $props();

	const classes: string[] = [];
	if (variant === 'adaptive') {
		classes.push('adaptive');
	} else if (variant === 'button') {
		classes.push('button');
	}
</script>

<svg class={classes.join(' ')} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
	{@render children?.()}
</svg>

<style>
	svg {
		color: currentColor;
		fill: none;
		height: 1em;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2.5;
		width: 1em;
	}

	@media screen and (max-width: 768px) {
		.adaptive {
			font-size: 32px;
			stroke-width: 1.5;
		}
	}

	.button {
		font-size: 32px;
		stroke-width: 1.5;
	}
</style>
