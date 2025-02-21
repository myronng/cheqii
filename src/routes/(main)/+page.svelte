<script lang="ts">
	import type { ChequeData } from '$lib/utils/common/cheque.svelte';
	import type { CheqiiUser } from '$lib/utils/common/user.svelte';

	import MainCallToAction from '$lib/components/main/mainCallToAction.svelte';
	import MainHeader from '$lib/components/main/mainHeader.svelte';
	import MainListing from '$lib/components/main/mainListing.svelte';
	import { idb } from '$lib/utils/common/indexedDb.svelte';

	let { data } = $props();
	let chequeList = $state(data.chequeList ?? []);

	$effect(() => {
		if (!chequeList && data.user?.id) {
			idb?.get<CheqiiUser>('users', data.user.id).then(async (user) => {
				if (user) {
					const cheques = await idb?.getAll<ChequeData>('cheques');
					// Handle cases where user access is removed while in the cheque
					const validCheques = cheques?.reduce<ChequeData[]>((acc, cheque) => {
						if (cheque.access.users[user.id]) {
							acc.push(cheque);
						}
						return acc;
					}, []);
					validCheques?.sort((a, b) => b.updatedAtClient - a.updatedAtClient);
					chequeList = validCheques ?? [];
				}
			});
		}
	});
</script>

<MainHeader strings={data.strings} supabase={data.supabase} userId={data.user.id} />
<main>
	<MainCallToAction strings={data.strings} userId={data.user.id} />
	{#if chequeList}
		<MainListing {chequeList} strings={data.strings} userId={data.user.id} />
	{/if}
</main>

<style>
	/* @media screen and (max-width: 768px) {
		main {
		}
	} */
	main {
		align-items: center;
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: calc(var(--length-spacing) * 2);
		padding: calc(var(--length-spacing) * 2);
	}
</style>
