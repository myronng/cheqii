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
		d="M12.5 22H6.59c-1.545 0-2.774-.752-3.877-1.803c-2.26-2.153 1.45-3.873 2.865-4.715A10.65 10.65 0 0 1 15 14.78m1.5-8.28a4.5 4.5 0 1 1-9 0a4.5 4.5 0 0 1 9 0m2 15.5v-7M15 18.5h7"
		color="currentColor"
	/>
</svg>
