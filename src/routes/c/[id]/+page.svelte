<script lang="ts">
	import ChequeGrid from '$lib/components/cheque/chequeGrid.svelte';
	import ChequeHeader from '$lib/components/cheque/chequeHeader.svelte';

	let { data } = $props();
</script>

<ChequeHeader strings={data.strings} title={data.cheque.title} />
<main>
	<ChequeGrid chequeData={data.cheque} strings={data.strings} />
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		overflow: auto;
	}
</style>
