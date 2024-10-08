<script lang="ts">
	import type { ComponentProps } from 'svelte';

	import Icon from '$lib/components/common/icons/icon.svelte';

	let props: ComponentProps<typeof Icon> = $props();
</script>

<Icon {...props}>
	<path d="M19 5L5 19M5 5l14 14" />
</Icon>
