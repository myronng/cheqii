<script lang="ts">
	import type { ComponentProps } from 'svelte';

	import Icon from '$lib/components/common/icons/icon.svelte';

	let props: ComponentProps<typeof Icon> = $props();
</script>

<Icon {...props}>
	<path d="M12 4v16m-8-8h16" />
</Icon>
