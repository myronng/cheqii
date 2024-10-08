<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import Button from '$lib/components/common/buttons/button.svelte';
	import ButtonLink from '$lib/components/common/buttons/buttonLink.svelte';
	import Add from '$lib/components/common/icons/add.svelte';
	import Folder from '$lib/components/common/icons/folder.svelte';
	import Logo from '$lib/components/common/logo.svelte';
	import { createChequeClient } from '$lib/utils/common/cheque.svelte';
	import { type User } from '$lib/utils/common/user.svelte';

	let { strings, userId }: { strings: LocalizedStrings; userId: User['id'] } = $props();
</script>

<svelte:head>
	<title>Cheqii</title>
</svelte:head>

{#snippet addIcon()}
	<Add variant="adaptive" />
{/snippet}

{#snippet folderIcon()}
	<Folder variant="adaptive" />
{/snippet}

<header>
	<Logo {strings} />
	<div class="actions">
		<ButtonLink borderless href="/cheques" icon={folderIcon} title={strings['yourCheques']}>
			<span class="buttonText">
				{strings['yourCheques']}
			</span>
		</ButtonLink>
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
	</div>
</header>

<style>
	@media screen and (max-width: 768px) {
		.buttonText {
			display: none;
		}
	}

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
