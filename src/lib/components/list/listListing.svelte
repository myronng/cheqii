<script lang="ts">
	import { interpolateString, type LocalizedStrings } from '$lib/utils/common/locale';

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
	<div class="headings">
		<span class="heading">{strings['chequeName']}</span>
		<span class="heading">{strings['lastModified']}</span>
		<span class="heading">{strings['owner']}</span>
	</div>
	{#each chequeList as cheque}
		{@const userName = cheque.access.users[cheque.owner]?.name || strings['anonymous']}
		<ListCheque href={`/cheques/${cheque.id}`}>
			<span>
				{cheque.name}
			</span>
			<span class="text">
				{DATE_FORMATTER.format(new Date(cheque.updatedAtClient))}
			</span>
			<span class="text">
				{cheque.owner === userId
					? interpolateString(strings['{user}(you)'], {
							user: userName
						})
					: userName}
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

	.text {
		color: var(--color-font-disabled);
	}

	.headings {
		display: grid;
		gap: calc(var(--length-spacing) * 2);
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		padding: var(--length-spacing);
	}
</style>
