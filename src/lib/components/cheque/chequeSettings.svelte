<script lang="ts">
	import type { ChequeData, OnChequeChange } from '$lib/types/cheque';
	import type { User } from '$lib/types/user';
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import ToggleButton from '$lib/components/common/buttons/toggleButton.svelte';
	import Dialog from '$lib/components/common/dialog.svelte';
	import Lock from '$lib/components/common/icons/lock.svelte';
	import Unlock from '$lib/components/common/icons/unlock.svelte';

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

<Dialog id="settingsDialog" {strings} title={strings['settings']}>
	<section class="settings">
		<fieldset class="access">
			<ToggleButton
				checked={chequeData.access.invite.required}
				class="accessType"
				id="private"
				name="access"
				onchange={async (e) => {
					chequeData.access.invite.required = e.currentTarget.checked;
					await onChequeChange();
				}}
				padding={2}
			>
				<div class="accessHeading">
					<Lock />
					<span>{strings['private']}</span>
				</div>
				<span class="accessDescription">{strings['onlyInvitedUsersCanAccessThisCheque']}</span>
			</ToggleButton>
			<ToggleButton
				checked={!chequeData.access.invite.required}
				class="accessType"
				id="public"
				name="access"
				onchange={async (e) => {
					chequeData.access.invite.required = !e.currentTarget.checked;
					await onChequeChange();
				}}
				padding={2}
			>
				<div class="accessHeading">
					<Unlock />
					<span>{strings['public']}</span>
				</div>
				<span class="accessDescription">{strings['anyoneOnTheInternetCanAccessThisCheque']}</span>
			</ToggleButton>
		</fieldset>
	</section>
</Dialog>

<style>
	.access {
		border: 0;
		display: flex;
		gap: var(--length-spacing);
		justify-content: space-between;
		padding: 0;
	}

	.accessHeading {
		display: flex;
		font-size: 1.35rem;
		gap: var(--length-spacing);
	}

	.accessDescription {
		color: var(--color-font-disabled);
	}

	.settings {
		display: flex;
		flex-direction: column;
		padding: var(--length-spacing);
	}
</style>
