<script lang="ts">
	import type { ChequeData, OnChequeChange } from '$lib/types/cheque';
	import type { User } from '$lib/types/user';
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import ChequeName from '$lib/components/cheque/chequeName.svelte';
	import IconButton from '$lib/components/common/buttons/iconButton.svelte';
	import Settings from '$lib/components/common/icons/settings.svelte';
	import Share from '$lib/components/common/icons/share.svelte';
	import Logo from '$lib/components/common/logo.svelte';

	let {
		chequeData = $bindable(),
		onChequeChange,
		strings,
		userId
	}: {
		chequeData: ChequeData;
		onChequeChange: OnChequeChange;
		strings: LocalizedStrings;
		userId: User['id'];
	} = $props();
</script>

<header>
	<section>
		<Logo hasTitle={false} {strings} />
		<ChequeName bind:chequeData {onChequeChange} {strings} />
	</section>
	<section>
		<IconButton
			onclick={async () => {
				if (navigator.canShare()) {
					await navigator.share({
						title: chequeData.name,
						url: window.location.href
					});
				} else {
					await navigator.clipboard.writeText(window.location.href);
				}
			}}
			title={strings['share']}
		>
			<Share height="32px" stroke-width="1.5" width="32px" />
		</IconButton>
		{#if chequeData.access.users[userId]?.authority === 'owner'}
			<IconButton
				onclick={() => {
					(document.getElementById('settingsDialog') as HTMLDialogElement).showModal();
				}}
				title={strings['settings']}
			>
				<Settings height="32px" stroke-width="1.5" width="32px" />
			</IconButton>
		{/if}
	</section>
</header>

<style>
	header {
		border-bottom: var(--length-divider) solid var(--color-divider);
		display: flex;
		flex-wrap: wrap;
		gap: var(--length-spacing);
		justify-content: space-between;
		padding: var(--length-spacing);

		section {
			display: flex;
			gap: var(--length-spacing);
		}
	}
</style>
