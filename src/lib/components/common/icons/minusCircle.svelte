<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	let props: SVGAttributes<SVGElement> = $props();
</script>

<svg
	color="currentColor"
	fill="none"
	height="1em"
	stroke="currentColor"
	stroke-linecap="round"
	stroke-linejoin="round"
	stroke-width="2.5"
	viewBox="0 0 24 24"
	width="1em"
	xmlns="http://www.w3.org/2000/svg"
	{...props}
>
	<path d="M16 12H8" />
	<circle cx="12" cy="12" r="10" />
</svg>
