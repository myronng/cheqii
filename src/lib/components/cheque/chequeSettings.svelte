<script lang="ts">
	import type { ChequeData, OnChequeChange } from '$lib/types/cheque';
	import type { LocalizedStrings } from '$lib/utils/common/locale';

	import IconButton from '$lib/components/common/buttons/iconButton.svelte';
	import ToggleButton from '$lib/components/common/buttons/toggleButton.svelte';
	import Cancel from '$lib/components/common/icons/cancel.svelte';
	import Lock from '$lib/components/common/icons/lock.svelte';
	import Unlock from '$lib/components/common/icons/unlock.svelte';
	import type { User } from '$lib/types/user';

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

<dialog id="settingsDialog">
	<div class="content">
		<h1 class="title">
			<span>{strings['settings']}</span>
			<IconButton
				onclick={() => {
					(document.getElementById('settingsDialog') as HTMLDialogElement).close();
				}}
				title={strings['close']}
			>
				<Cancel height={24} width={24} />
			</IconButton>
		</h1>
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
	</div>
</dialog>

<style>
	@media screen and (max-width: 768px) {
		#settingsDialog {
			background:
				linear-gradient(135deg, transparent 4px, var(--color-background-secondary) 4.01px) top left,
				linear-gradient(45deg, var(--color-background-secondary) 2px, transparent 2.01px) top left,
				linear-gradient(135deg, var(--color-background-secondary) 2px, transparent 2.01px) bottom
					left,
				linear-gradient(45deg, transparent 4px, var(--color-background-secondary) 4.01px) bottom
					left;
			background-size: 6px 3px;
			background-repeat: repeat-x;
			height: 100vh;
			margin: 0;
			max-height: unset;
			max-width: unset;
			padding: 3px calc(var(--length-spacing) * 0.5);
			width: 100vw;
		}
	}

	@media screen and (min-width: 768px) {
		#settingsDialog {
			background:
				linear-gradient(135deg, transparent 4px, var(--color-background-secondary) 4.01px) top left,
				linear-gradient(45deg, var(--color-background-secondary) 2px, transparent 2.01px) top left,
				linear-gradient(135deg, var(--color-background-secondary) 2px, transparent 2.01px) bottom
					left,
				linear-gradient(45deg, transparent 4px, var(--color-background-secondary) 4.01px) bottom
					left;
			background-size: 6px 3px;
			background-repeat: repeat-x;
			bottom: 0;
			left: 0;
			margin: auto;
			padding: 3px 0;
			right: 0;
			top: 0;
		}
	}

	#settingsDialog {
		border: 0;
		color: currentColor;

		@media (prefers-reduced-motion: no-preference) {
			transition:
				ease transform 225ms,
				display 225ms allow-discrete;

			@starting-style {
				transform: translateY(100vh);
			}

			&:not([open]) {
				transform: translateY(100vh);
			}
		}

		&::backdrop {
			background-color: var(--color-background-backdrop);
		}
	}

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

	.content {
		background-color: var(--color-background-secondary);
		min-height: 100%;
	}

	.settings {
		display: flex;
		flex-direction: column;
		padding: var(--length-spacing);
	}

	.title {
		align-items: center;
		border-bottom: var(--length-divider) solid var(--color-divider);
		display: flex;
		gap: var(--length-spacing);
		justify-content: space-between;
		padding: var(--length-spacing);
	}
</style>
