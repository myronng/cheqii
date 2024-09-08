<script lang="ts">
	import Input from '$lib/components/common/input.svelte';

	let { title }: { title: string } = $props();
	let value = $state(title);
</script>

<svelte:head>
	<title>{value}</title>
</svelte:head>

<Input bind:value />
