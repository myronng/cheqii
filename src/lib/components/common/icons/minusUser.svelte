<script lang="ts">
	import type { ComponentProps } from 'svelte';

	import Icon from '$lib/components/common/icons/icon.svelte';

	let props: ComponentProps<typeof Icon> = $props();
</script>

<Icon {...props}>
	<path
		d="M12.5 22H6.59c-1.545 0-2.774-.752-3.877-1.803c-2.26-2.153 1.45-3.873 2.865-4.715A10.65 10.65 0 0 1 15 14.78m.5-8.28a4.5 4.5 0 1 1-9 0a4.5 4.5 0 0 1 9 0m-.5 12h7"
	/>
</Icon>
