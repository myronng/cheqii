<script lang="ts">
	import type { ChequeData } from '$lib/utils/common/cheque.svelte';
	import type { User } from '$lib/utils/common/user.svelte';

	import MainCheque from '$lib/components/main/mainCheque.svelte';
	import { DATE_FORMATTER } from '$lib/utils/common/formatter';
	import { interpolateString, type LocalizedStrings } from '$lib/utils/common/locale';

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
	{#each chequeList as cheque, index}
		{@const userName = cheque.access.users[cheque.owner]?.name || strings['anonymous']}
		<MainCheque alternate={index % 2 === 0} href={`/cheques/${cheque.id}`}>
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
		</MainCheque>
	{/each}
</section>

<style>
	section {
		display: grid;
		grid-template-columns: 1fr max-content max-content;
		max-inline-size: 900px;
		inline-size: 100%;
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
