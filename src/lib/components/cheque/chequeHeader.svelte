<script lang="ts">
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import ChequeTitle from '$lib/components/cheque/chequeTitle.svelte';
	import IconButton from '$lib/components/common/buttons/iconButton.svelte';
	import Settings from '$lib/components/common/icons/settings.svelte';
	import Share from '$lib/components/common/icons/share.svelte';
	import Logo from '$lib/components/common/logo.svelte';
	import type { ChequeData, OnChequeChange } from '$lib/types/cheque';
	import type { User } from '$lib/types/user';
	import { interpolateString } from '$lib/utils/common/locale';

	let {
		chequeData = $bindable(),
		onChequeChange,
		strings,
		title,
		userId
	}: {
		chequeData: ChequeData;
		onChequeChange: OnChequeChange;
		strings: LocalizedStrings;
		title?: string;
		userId: User['id'];
	} = $props();

	if (!title) {
		const currentDate = new Date();
		title = interpolateString(strings['cheque{date}'], {
			date: currentDate.toISOString().split('T')[0]
		});
	}
</script>

<header>
	<section>
		<Logo hasTitle={false} {strings} />
		<ChequeTitle bind:chequeData {onChequeChange} {strings} {title} />
	</section>
	<section>
		<IconButton
			onclick={async () => {
				try {
					await navigator.share({
						title,
						url: window.location.href
					});
				} catch (err) {
					navigator.clipboard.writeText(window.location.href);
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
