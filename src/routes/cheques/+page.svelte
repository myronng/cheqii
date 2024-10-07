<script lang="ts">
	import type { ChequeData } from '$lib/utils/common/cheque.svelte';
	import type { User } from '$lib/utils/common/user.svelte';

	import Loader from '$lib/components/common/loader.svelte';
	import ListHeader from '$lib/components/list/listHeader.svelte';
	import ListListing from '$lib/components/list/listListing.svelte';
	import { idb } from '$lib/utils/common/indexedDb.svelte';

	let { data } = $props();
	let chequeList = $state(data.chequeList);

	$effect(() => {
		if (!chequeList) {
			idb?.get<User>('users', data.userId).then(async (user) => {
				if (user) {
					const cheques = await idb?.getAll<ChequeData>('cheques');
					// Handle cases where user access is removed while in the cheque
					chequeList = cheques ?? [];
				}
			});
		}
	});
</script>

{#if chequeList}
	<ListHeader strings={data.strings} userId={data.userId} />
	<main>
		<ListListing {chequeList} strings={data.strings} userId={data.userId} />
	</main>
{:else}
	<div class="loader">
		<Loader />
	</div>
{/if}

<style>
	main {
		align-items: center;
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: var(--length-spacing);
		justify-content: space-around;
		padding: var(--length-spacing);
		position: relative;
	}

	.loader {
		align-items: center;
		display: flex;
		flex: 1;
		justify-content: center;
	}
</style>
