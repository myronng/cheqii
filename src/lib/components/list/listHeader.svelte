<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import Button from '$lib/components/common/buttons/button.svelte';
	import Add from '$lib/components/common/icons/add.svelte';
	import Logo from '$lib/components/common/logo.svelte';
	import { createChequeClient } from '$lib/utils/common/cheque.svelte';
	import { type User } from '$lib/utils/common/user.svelte';

	let { strings, userId }: { strings: LocalizedStrings; userId: User['id'] } = $props();
</script>

<svelte:head>
	<title>{strings['yourCheques']}</title>
</svelte:head>

<header>
	<Logo {strings} />
	<div class="actions">
		<Button
			onclick={async () => {
				await createChequeClient(strings, userId);
			}}
		>
			<Add />
			{strings['newCheque']}
		</Button>
	</div>
</header>

<style>
	header {
		display: flex;
		gap: var(--length-spacing);
		justify-content: space-between;
		padding: var(--length-spacing);
	}

	.actions {
		display: flex;
		gap: var(--length-spacing);
	}
</style>
