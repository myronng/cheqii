<script lang="ts">
	import Input from '$lib/components/common/input.svelte';

	const currentDate = new Date();
	let {
		title = $bindable(`Cheque ${currentDate.toISOString().split('T')[0]}`)
	}: { title?: string } = $props();
	let value = $state(title);
</script>

<svelte:head>
	<title>{value}</title>
</svelte:head>

<Input bind:value placeholder="Cheque Name" />
