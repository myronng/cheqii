<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	let props: SVGAttributes<SVGElement> = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	stroke-width="1.5"
	width="1em"
	height="1em"
	viewBox="0 0 24 24"
	{...props}
>
	<path
		fill="none"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-linejoin="round"
		d="M21 6.5a3 3 0 1 1-6 0a3 3 0 0 1 6 0M9 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0m12 5.5a3 3 0 1 1-6 0a3 3 0 0 1 6 0M8.729 10.75l6.5-3m-6.5 5.5l6.5 3"
		color="currentColor"
	/>
</svg>
