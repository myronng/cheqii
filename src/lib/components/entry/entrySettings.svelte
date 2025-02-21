<script lang="ts">
	import type { ChequeData, OnChequeChange } from '$lib/utils/common/cheque.svelte.ts';

	import { goto } from '$app/navigation';
	import ListButton from '$lib/components/base/buttons/listButton.svelte';
	import ToggleButton from '$lib/components/base/buttons/toggleButton.svelte';
	import Dialog from '$lib/components/base/dialog.svelte';
	import Input from '$lib/components/base/input.svelte';
	import EntryShare from '$lib/components/entry/entryShare.svelte';
	import Delete from '$lib/components/icons/delete.svelte';
	import Door from '$lib/components/icons/door.svelte';
	import Download from '$lib/components/icons/download.svelte';
	import Link from '$lib/components/icons/link.svelte';
	import Lock from '$lib/components/icons/lock.svelte';
	import SyncLock from '$lib/components/icons/syncLock.svelte';
	import Unlink from '$lib/components/icons/unlink.svelte';
	import Unlock from '$lib/components/icons/unlock.svelte';
	import { idb } from '$lib/utils/common/indexedDb.svelte';
	import { type LocalizedStrings, interpolateString } from '$lib/utils/common/locale';
	import { type CheqiiUser, type OnUserChange, getUser } from '$lib/utils/common/user.svelte';

	let {
		chequeData = $bindable(),
		currencyFactor,
		onChequeChange,
		onUserChange,
		strings,
		url,
		userId
	}: {
		chequeData: ChequeData;
		currencyFactor: number;
		onChequeChange: OnChequeChange;
		onUserChange: OnUserChange;
		strings: LocalizedStrings;
		url: string;
		userId: CheqiiUser['id'];
	} = $props();
</script>

<Dialog id="settingsDialog" {strings} title={strings['settings']}>
	<section class="settings">
		<fieldset class="access" disabled={chequeData.access.users[userId]?.authority !== 'owner'}>
			<ToggleButton
				checked={chequeData.access.invite.required}
				class="accessType"
				id="private"
				name="access"
				onchange={async (e) => {
					chequeData.access.invite.required = e.currentTarget.checked;
					await onChequeChange(chequeData);
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
					await onChequeChange(chequeData);
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
		<fieldset class="invite">
			<Input readonly title={strings['inviteLink']} value={url} />
			<EntryShare {strings} title={chequeData.name} {url} />
		</fieldset>
		<article class="users">
			<h2>{strings['users']}</h2>
			{#each Object.entries(chequeData.access.users) as [id, user]}
				{@const linkedContributorName = chequeData.contributors.find(
					(contributor) => contributor.id === id
				)?.name}
				{@const userName = user.name || strings['anonymous']}
				<ListButton>
					<span>
						{id === userId
							? interpolateString(strings['{user}(you)'], {
									user: userName
								})
							: userName}
					</span>
					{#if linkedContributorName}
						<div class="link">
							<Link />
							<span>
								{linkedContributorName}
							</span>
						</div>
					{:else}
						<div class="link unlinked">
							<Unlink />
							<span>
								{strings['notLinked']}
							</span>
						</div>
					{/if}
					<span class="authority">{strings[user.authority]}</span>
				</ListButton>
			{/each}
		</article>
		<article class="cheque">
			<h2>{strings['cheque']}</h2>
			<ListButton
				onclick={() => {
					const formatCsv = (data: string) => {
						const newData = data.replaceAll(/"/g, '""');
						if (newData.includes(',') || newData.includes('\n')) {
							return `"${newData}"`;
						}
						return newData;
					};
					const csv = [
						[
							formatCsv(strings['item']),
							formatCsv(strings['cost']),
							formatCsv(strings['buyer']),
							chequeData.contributors.map((contributor) => formatCsv(contributor.name))
						].join(','),
						...chequeData.items.map((item) =>
							[
								formatCsv(item.name),
								formatCsv((item.cost / currencyFactor).toString()),
								formatCsv(chequeData.contributors[item.buyer].name),
								formatCsv(item.split.toString())
							]
								.flat()
								.join(',')
						)
					].join('\r\n');
					const csvBlob = new Blob([csv], { type: 'text/csv; charset=utf-8' });
					const csvUrl = URL.createObjectURL(csvBlob);
					const tempLink = document.createElement('a');
					tempLink.download = `${chequeData.name}.csv`;
					tempLink.href = csvUrl;
					document.body.appendChild(tempLink);
					tempLink.click();
					document.body.removeChild(tempLink);
				}}
			>
				<Download variant="button" />
				<div class="buttonText">
					<span>
						{strings['downloadCsv']}
					</span>
					<span class="buttonBody">{strings['exportChequeDataToUseInOtherApplications']}</span>
				</div>
			</ListButton>
			<hr />
			{#if chequeData.access.users[userId]?.authority === 'owner'}
				<ListButton
					color="error"
					hidden={!chequeData.access.invite.required}
					onclick={() => {
						chequeData.access.invite.id = crypto.randomUUID();
						onChequeChange(chequeData);
					}}
				>
					<SyncLock variant="button" />
					<div class="buttonText">
						<span>
							{strings['regenerateInviteLink']}
						</span>
						<span class="buttonBody">
							{strings['theCurrentInvitationLinkWillNoLongerWork']}
						</span>
					</div>
				</ListButton>
				<ListButton
					color="error"
					onclick={async () => {
						const user = await getUser(userId);
						await Promise.all([
							idb?.delete('cheques', chequeData.id),
							onUserChange({
								cheques: user.get?.cheques.filter((cheque) => cheque !== chequeData.id) ?? []
							})
						]);
						goto('/');
					}}
				>
					<Delete variant="button" />
					<div class="buttonText">
						<span>
							{strings['deleteCheque']}
						</span>
						<span class="buttonBody">
							{strings['thisWillDeleteTheChequeForAllUsers']}
						</span>
					</div>
				</ListButton>
			{:else}
				<ListButton
					color="error"
					onclick={async () => {
						const user = await getUser(userId);
						const { [userId]: _, ...filteredUsers } = chequeData.access.users;
						chequeData.access.users = filteredUsers;
						await Promise.all([
							onChequeChange(chequeData),
							onUserChange({
								cheques: user.get?.cheques.filter((cheque) => cheque !== chequeData.id) ?? []
							})
						]);
						goto('/');
					}}
				>
					<Door variant="button" />
					<div class="buttonText">
						<span>
							{strings['leaveCheque']}
						</span>
						<span class="buttonBody">
							{strings['youWillNotBeAbleToAccessThisChequeAnymore']}
						</span>
					</div>
				</ListButton>
			{/if}
		</article>
	</section>
</Dialog>

<style>
	article {
		background-color: var(--color-background-primary);
		border-radius: var(--length-radius);
		display: flex;
		flex-direction: column;
		overflow: hidden;

		h2 {
			margin: calc(var(--length-spacing) * 2);
		}
	}

	fieldset {
		border: 0;
		display: flex;
		gap: calc(var(--length-spacing) * 2);
		padding: 0;
	}

	hr {
		border: 0;
		border-block-start: var(--length-divider) dashed var(--color-divider);
		margin-block: var(--length-spacing);
	}

	.access {
		justify-content: center;

		.accessDescription {
			color: var(--color-font-disabled);
		}

		.accessHeading {
			display: flex;
			font-size: 1.3rem;
			gap: var(--length-spacing);
		}
	}

	.cheque {
		.buttonBody {
			color: var(--color-font-disabled);
		}

		.buttonText {
			display: flex;
			flex-direction: column;
			gap: var(--length-spacing);
		}
	}

	.settings {
		display: flex;
		flex-direction: column;
		gap: calc(var(--length-spacing) * 2);
		padding: calc(var(--length-spacing) * 2);
	}

	.users {
		.authority {
			color: var(--color-font-disabled);
			margin-left: auto;
		}

		.link {
			display: flex;
			gap: var(--length-spacing);

			&:not(.unlinked) {
				color: var(--color-font-primary);
			}

			&.unlinked {
				color: var(--color-font-inactive);
			}
		}
	}
</style>
