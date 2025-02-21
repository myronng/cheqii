<script lang="ts">
	import type { ComponentProps } from 'svelte';

	import Icon from '$lib/components/icons/icon.svelte';

	let props: ComponentProps<typeof Icon> = $props();
</script>

<Icon {...props}>
	<path
		d="m9.52 14.436l4.914-4.913m-1.865 5.586c.74 1.14.542 2.309-.313 3.164l-2.995 2.995a2.505 2.505 0 0 1-3.543 0l-2.986-2.986a2.505 2.505 0 0 1 0-3.543l2.995-2.996c.702-.702 2.036-1.107 3.183-.277m6.198 1.103c1.14.74 2.31.542 3.164-.312l2.995-2.996a2.505 2.505 0 0 0 0-3.543l-2.986-2.986a2.505 2.505 0 0 0-3.543 0l-2.995 2.995c-.702.702-1.107 2.036-.277 3.183"
	/>
</Icon>
