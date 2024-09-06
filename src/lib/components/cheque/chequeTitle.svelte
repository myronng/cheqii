<script lang="ts">
	import Input from '$lib/components/common/input.svelte';

	const currentDate = new Date();
	let { initialValue = $bindable(`Cheque ${currentDate.toISOString().split('T')[0]}`) } = $props();
	let value = $state(initialValue);
</script>

<svelte:head>
	<title>{value}</title>
</svelte:head>

<Input bind:value placeholder="Cheque Name" />
