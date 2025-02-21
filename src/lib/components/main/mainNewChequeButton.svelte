<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';
	import type { CheqiiUser } from '$lib/utils/common/user.svelte';

	import Button from '$lib/components/base/buttons/button.svelte';
	import Add from '$lib/components/icons/add.svelte';
	import { createChequeClient } from '$lib/utils/common/cheque.svelte';

	let { strings, userId }: { strings: LocalizedStrings; userId: CheqiiUser['id'] } = $props();
</script>

{#snippet addIcon()}
	<Add variant="adaptive" />
{/snippet}

<Button
	onclick={async () => {
		await createChequeClient(strings, userId);
	}}
	icon={addIcon}
	title={strings['newCheque']}
>
	<span class="buttonText">
		{strings['newCheque']}
	</span>
</Button>

<style>
	@media screen and (max-width: 768px) {
		.buttonText {
			display: none;
		}
	}
</style>
