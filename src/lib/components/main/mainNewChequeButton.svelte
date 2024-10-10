<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';
	import type { User } from '$lib/utils/common/user.svelte';

	import Button from '$lib/components/common/buttons/button.svelte';
	import Add from '$lib/components/common/icons/add.svelte';
	import { createChequeClient } from '$lib/utils/common/cheque.svelte';

	let { strings, userId }: { strings: LocalizedStrings; userId: User['id'] } = $props();
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
