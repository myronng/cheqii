<script lang="ts">
  import { page } from "$app/state";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import ListButton from "$lib/components/base/buttons/ListButton.svelte";
  import ToggleButton from "$lib/components/base/buttons/ToggleButton.svelte";
  import Dialog from "$lib/components/base/Dialog.svelte";
  import Input from "$lib/components/base/Input.svelte";
  import EntryShare from "$lib/components/entry/EntryShare.svelte";
  import Delete from "$lib/components/icons/Delete.svelte";
  import Door from "$lib/components/icons/Door.svelte";
  import Download from "$lib/components/icons/Download.svelte";
  import Link from "$lib/components/icons/Link.svelte";
  import Lock from "$lib/components/icons/Lock.svelte";
  import Refresh from "$lib/components/icons/Refresh.svelte";
  import Unlink from "$lib/components/icons/Unlink.svelte";
  import Unlock from "$lib/components/icons/Unlock.svelte";
  import { deleteCheque, leaveCheque, updateCheque } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";
  import type { ChequeData } from "$lib/state/model";
  import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";

  let {
    chequeData,
    currencyFactor,
    strings,
    url,
    userId,
  }: {
    chequeData: ChequeData;
    currencyFactor: number;
    strings: LocalizedStrings;
    url: string;
    userId: string;
  } = $props();

  const app = getAppContext();
  const supabase = $derived(page.data.supabase);
  const chequeUser = $derived(chequeData.cheque_users.find(({ user_id }) => user_id === userId));
  const isOwner = $derived(chequeUser?.role === "owner");

  // Invite link (auth-invite spec §3.3). A PRIVATE cheque needs a capability-token
  // link — `/invite/<chequeId>#<inviteId>` (token in the fragment so it never hits
  // server/proxy logs) — for anyone to gain access; opening it redeems the token
  // (join_cheque_via_invite) and joins them as an editor. A PUBLIC cheque is readable
  // by anyone with the plain cheque URL, so no token is shown.
  // Owner-only: RLS scopes the invites table to the cheque owner.
  let inviteId = $state<string | null>(null);
  let loadingInvite = $state(false);

  async function ensureInvite() {
    if (!supabase || !isOwner || loadingInvite) return;
    loadingInvite = true;
    try {
      const { data } = await supabase
        .from("invites")
        .select("id")
        .eq("cheque_id", chequeData.id)
        .eq("role", "editor")
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        inviteId = data[0].id;
      } else {
        const { data: created } = await supabase
          .from("invites")
          .insert({ cheque_id: chequeData.id, role: "editor", created_by: userId })
          .select("id")
          .single();
        inviteId = created?.id ?? null;
      }
    } finally {
      loadingInvite = false;
    }
  }

  // Regenerate: revoke every live editor invite, then mint a fresh one — old links
  // die immediately (spec §3.3 "regenerating changes the token; existing links die").
  async function regenerateInvite() {
    if (!supabase || !isOwner) return;
    inviteId = null;
    await supabase
      .from("invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("cheque_id", chequeData.id)
      .eq("role", "editor")
      .is("revoked_at", null);
    await ensureInvite();
  }

  // A private cheque (owner view) shows the token link; otherwise the plain cheque URL.
  const shareUrl = $derived.by(() => {
    if (chequeData.visibility === "private" && isOwner) {
      return inviteId ? `${page.url.origin}/invite/${chequeData.id}#${inviteId}` : "";
    }
    return url;
  });

  $effect(() => {
    if (chequeData.visibility === "private" && isOwner && !inviteId) {
      void ensureInvite();
    }
  });

  // v2 roles → existing locale keys (precise editor/viewer labels arrive with i18n, 5.6).
  const roleLabel = (role: "owner" | "editor" | "viewer") =>
    role === "owner" ? strings["owner"] : role === "editor" ? strings["invited"] : strings["public"];

  const formatCsv = (data: string) => {
    const newData = data.replaceAll(/"/g, '""');
    if (newData.includes(",") || newData.includes("\n")) return `"${newData}"`;
    return newData;
  };
</script>

{#snippet regenerateIcon()}
  <Refresh variant="button" />
{/snippet}

<Dialog hash="settings" {strings} title={strings["settings"]}>
  <section class="settings">
    <fieldset class="access" disabled={chequeUser?.role !== "owner"}>
      <ToggleButton
        checked={chequeData.visibility === "private"}
        class="accessType"
        id="private"
        name="access"
        onchange={async () => {
          await updateCheque(app, chequeData.id, { visibility: "private" });
        }}
        padding={2}
      >
        <div class="accessHeading">
          <Lock />
          <span>{strings["private"]}</span>
        </div>
        <span class="accessDescription">{strings["onlyInvitedUsersCanAccessThisCheque"]}</span>
      </ToggleButton>
      <ToggleButton
        checked={chequeData.visibility === "public_read"}
        class="accessType"
        id="public"
        name="access"
        onchange={async () => {
          await updateCheque(app, chequeData.id, { visibility: "public_read" });
        }}
        padding={2}
      >
        <div class="accessHeading">
          <Unlock />
          <span>{strings["public"]}</span>
        </div>
        <span class="accessDescription">{strings["anyoneOnTheInternetCanAccessThisCheque"]}</span>
      </ToggleButton>
    </fieldset>
    <fieldset class="invite">
      <Input readonly title={strings["inviteLink"]} value={shareUrl} />
      <EntryShare {strings} title={chequeData.name} url={shareUrl} />
      {#if chequeData.visibility === "private" && isOwner}
        <Button
          borderless
          icon={regenerateIcon}
          onclick={regenerateInvite}
          title={strings["regenerateInviteLink"]}
        />
      {/if}
    </fieldset>
    <article class="users">
      <h2>{strings["users"]}</h2>
      {#each chequeData.cheque_users as bu}
        {@const linkedContributorName = chequeData.cheque_contributors.find(
          (contributor) => contributor.linked_user_id === bu.user_id || contributor.id === bu.user_id,
        )?.name}
        {@const userName = linkedContributorName || strings["anonymous"]}
        <ListButton>
          <span>
            {bu.user_id === userId
              ? interpolateString(strings["{user}(you)"], { user: userName })
              : userName}
          </span>
          {#if linkedContributorName}
            <div class="link">
              <Link />
              <span>{linkedContributorName}</span>
            </div>
          {:else}
            <div class="link unlinked">
              <Unlink />
              <span>{strings["notLinked"]}</span>
            </div>
          {/if}
          <span class="authority">{roleLabel(bu.role)}</span>
        </ListButton>
      {/each}
    </article>
    <article class="cheque">
      <h2>{strings["cheque"]}</h2>
      <ListButton
        onclick={() => {
          const csv = [
            [
              formatCsv(strings["item"]),
              formatCsv(strings["cost"]),
              formatCsv(strings["buyer"]),
              chequeData.cheque_contributors.map((contributor) => formatCsv(contributor.name)),
            ].join(","),
            ...chequeData.cheque_items.map((item) =>
              [
                formatCsv(item.name),
                formatCsv((item.cost / currencyFactor).toString()),
                formatCsv(
                  chequeData.cheque_contributors.find(
                    (contributor) => contributor.id === item.contributor_id,
                  )?.name ?? "",
                ),
                formatCsv(
                  chequeData.cheque_item_splits
                    .filter((split) => split.item_id === item.id)
                    .map((split) => split.ratio.toString())
                    .join(","),
                ),
              ]
                .flat()
                .join(","),
            ),
          ].join("\r\n");
          const csvBlob = new Blob([csv], { type: "text/csv; charset=utf-8" });
          const csvUrl = URL.createObjectURL(csvBlob);
          const tempLink = document.createElement("a");
          tempLink.download = `${chequeData.name}.csv`;
          tempLink.href = csvUrl;
          document.body.appendChild(tempLink);
          tempLink.click();
          document.body.removeChild(tempLink);
        }}
      >
        <Download variant="button" />
        <div class="buttonText">
          <span>{strings["downloadCsv"]}</span>
          <span class="buttonBody">{strings["exportChequeDataToUseInOtherApplications"]}</span>
        </div>
      </ListButton>
      <hr />
      {#if chequeUser?.role === "owner"}
        <ListButton
          color="error"
          onclick={async () => {
            await deleteCheque(app, chequeData.id);
          }}
        >
          <Delete variant="button" />
          <div class="buttonText">
            <span>{strings["deleteCheque"]}</span>
            <span class="buttonBody">{strings["thisWillDeleteTheChequeForAllUsers"]}</span>
          </div>
        </ListButton>
      {:else}
        <ListButton
          color="error"
          onclick={async () => {
            await leaveCheque(app, chequeData.id);
          }}
        >
          <Door variant="button" />
          <div class="buttonText">
            <span>{strings["leaveCheque"]}</span>
            <span class="buttonBody">{strings["youWillNotBeAbleToAccessThisChequeAnymore"]}</span>
          </div>
        </ListButton>
      {/if}
    </article>
  </section>
</Dialog>

<style>
  article {
    background-color: var(--color-background);
    border-radius: var(--radius-card);
    display: flex;
    flex-direction: column;
    overflow: hidden;

    h2 {
      margin: calc(var(--space-2) * 2);
    }
  }

  fieldset {
    border: 0;
    display: flex;
    gap: calc(var(--space-2) * 2);
    padding: 0;
  }

  hr {
    border: 0;
    border-block-start: var(--border-divider) dashed var(--color-border);
    margin-block: var(--space-2);
  }

  .access {
    justify-content: center;

    .accessDescription {
      color: var(--color-text-muted);
    }

    .accessHeading {
      display: flex;
      font-size: 1.3rem;
      gap: var(--space-2);
    }
  }

  .cheque {
    .buttonBody {
      color: var(--color-text-muted);
    }

    .buttonText {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: calc(var(--space-2) * 2);
    padding: calc(var(--space-2) * 2);
  }

  .users {
    .authority {
      color: var(--color-text-muted);
      margin-left: auto;
    }

    .link {
      display: flex;
      gap: var(--space-2);

      &:not(.unlinked) {
        color: var(--color-text);
      }

      &.unlinked {
        color: var(--color-text-inactive);
      }
    }
  }
</style>
