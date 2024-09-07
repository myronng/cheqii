<script lang="ts">
	import ChequeGrid from '$lib/components/cheque/chequeGrid.svelte';
	import ChequeHeader from '$lib/components/cheque/chequeHeader.svelte';

	let { data } = $props();
</script>

<ChequeHeader title={data.cheque.title} url={data.url} />
<main>
	<ChequeGrid chequeData={data.cheque} />
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		overflow: auto;
	}
</style>
