<script lang="ts">
	import type { ChequeData } from '$lib/utils/common/cheque.svelte';
	import type { User } from '$lib/utils/common/user.svelte';

	import Loader from '$lib/components/common/loader.svelte';
	import ListHeader from '$lib/components/list/listHeader.svelte';
	import { idb } from '$lib/utils/common/indexedDb.svelte';

	let { data } = $props();
	let chequeList = $state(data.chequeList);

	$effect(() => {
		if (!chequeList) {
			idb?.get<User>('users', data.userId).then(async (user) => {
				if (user) {
					const cheques = await idb?.getAll<ChequeData>('cheques');
					console.log(cheques);
					// Handle cases where user access is removed while in the cheque
					chequeList = cheques;
				}
			});
		}
	});
</script>

{#if chequeList}
	<ListHeader strings={data.strings} userId={data.userId} />
	<main>
		<section>
			{#each chequeList as cheque}
				<article>
					{cheque.id}
				</article>
			{/each}
		</section>
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
		gap: calc(var(--length-spacing) * 4);
		justify-content: space-around;
		padding: calc(var(--length-spacing) * 4);
		position: relative;
	}

	.loader {
		align-items: center;
		display: flex;
		flex: 1;
		justify-content: center;
	}
</style>
