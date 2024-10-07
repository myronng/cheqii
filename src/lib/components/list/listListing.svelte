<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import ListCheque from '$lib/components/list/listCheque.svelte';
	import { type ChequeData } from '$lib/utils/common/cheque.svelte';
	import { DATE_FORMATTER } from '$lib/utils/common/formatter';
	import { type User } from '$lib/utils/common/user.svelte';

	let {
		chequeList,
		strings,
		userId
	}: { chequeList: ChequeData[]; strings: LocalizedStrings; userId: User['id'] } = $props();
</script>

<section>
	<span>{strings['chequeName']}</span>
	<span>{strings['lastModified']}</span>
	{#each chequeList as cheque}
		<ListCheque href={`/cheques/${cheque.id}`}>
			<span>
				{cheque.name}
			</span>
			<span>
				{DATE_FORMATTER.format(new Date(cheque.updatedAtClient))}
			</span>
		</ListCheque>
	{/each}
</section>

<style>
	section {
		display: grid;
		grid-template-columns: 1fr max-content max-content max-content;
		max-width: 900px;
		width: 100%;
	}
</style>
