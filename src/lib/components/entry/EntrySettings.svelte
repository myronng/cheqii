<script lang="ts">
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
  import SyncLock from "$lib/components/icons/SyncLock.svelte";
  import Unlink from "$lib/components/icons/Unlink.svelte";
  import Unlock from "$lib/components/icons/Unlock.svelte";
  import { getAppContext } from "$lib/utils/common/context.svelte";
  import {
    type LocalizedStrings,
    interpolateString,
  } from "$lib/utils/common/locale";
  import {
    type BillData,
    deleteBill,
    updateBill,
  } from "$lib/utils/models/bill.svelte";
  import { type UserData, leaveBill } from "$lib/utils/models/user.svelte";

  let {
    billData = $bindable(),
    currencyFactor,
    strings,
    url,
    userId,
  }: {
    billData: BillData;
    currencyFactor: number;
    strings: LocalizedStrings;
    url: string;
    userId: UserData["id"];
  } = $props();

  const app = getAppContext();
  const { user } = app;

  const billUser = billData.bill_users.find(
    ({ user_id }) => user_id === userId,
  );

  const formatCsv = (data: string) => {
    const newData = data.replaceAll(/"/g, '""');
    if (newData.includes(",") || newData.includes("\n")) {
      return `"${newData}"`;
    }
    return newData;
  };
</script>

<Dialog id="settingsDialog" {strings} title={strings["settings"]}>
  <section class="settings">
    <fieldset class="access" disabled={billUser?.authority !== "owner"}>
      <ToggleButton
        checked={billData.invite_required}
        class="accessType"
        id="private"
        name="access"
        onchange={async (e) => {
          await updateBill(app, billData, {
            invite_required: e.currentTarget.checked,
          });
        }}
        padding={2}
      >
        <div class="accessHeading">
          <Lock />
          <span>{strings["private"]}</span>
        </div>
        <span class="accessDescription"
          >{strings["onlyInvitedUsersCanAccessThisBill"]}</span
        >
      </ToggleButton>
      <ToggleButton
        checked={!billData.invite_required}
        class="accessType"
        id="public"
        name="access"
        onchange={async (e) => {
          await updateBill(app, billData, {
            invite_required: !e.currentTarget.checked,
          });
        }}
        padding={2}
      >
        <div class="accessHeading">
          <Unlock />
          <span>{strings["public"]}</span>
        </div>
        <span class="accessDescription"
          >{strings["anyoneOnTheInternetCanAccessThisBill"]}</span
        >
      </ToggleButton>
    </fieldset>
    <fieldset class="invite">
      <Input readonly title={strings["inviteLink"]} value={url} />
      <EntryShare {strings} title={billData.name} {url} />
    </fieldset>
    <article class="users">
      <h2>{strings["users"]}</h2>
      {#each billData.bill_users as bu}
        {@const linkedContributorName = billData.bill_contributors.find(
          (contributor) => contributor.id === bu.user_id,
        )?.name}
        {@const userName = linkedContributorName || strings["anonymous"]}
        <ListButton>
          <span>
            {bu.user_id === userId
              ? interpolateString(strings["{user}(you)"], {
                  user: userName,
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
                {strings["notLinked"]}
              </span>
            </div>
          {/if}
          <span class="authority">{strings[bu.authority]}</span>
        </ListButton>
      {/each}
    </article>
    <article class="bill">
      <h2>{strings["bill"]}</h2>
      <ListButton
        onclick={() => {
          const csv = [
            [
              formatCsv(strings["item"]),
              formatCsv(strings["cost"]),
              formatCsv(strings["buyer"]),
              billData.bill_contributors.map((contributor) =>
                formatCsv(contributor.name),
              ),
            ].join(","),
            ...billData.bill_items.map((item) =>
              [
                formatCsv(item.name),
                formatCsv((item.cost / currencyFactor).toString()),
                formatCsv(
                  billData.bill_contributors.find(
                    (contributor) => contributor.id === item.contributor_id,
                  )?.name ?? "",
                ),
                formatCsv(
                  item.bill_item_splits
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
          tempLink.download = `${billData.name}.csv`;
          tempLink.href = csvUrl;
          document.body.appendChild(tempLink);
          tempLink.click();
          document.body.removeChild(tempLink);
        }}
      >
        <Download variant="button" />
        <div class="buttonText">
          <span>
            {strings["downloadCsv"]}
          </span>
          <span class="buttonBody"
            >{strings["exportBillDataToUseInOtherApplications"]}</span
          >
        </div>
      </ListButton>
      <hr />
      {#if billUser?.authority === "owner"}
        <ListButton
          color="error"
          hidden={!billData.invite_required}
          onclick={async () => {
            await updateBill(app, billData, {
              invite_id: crypto.randomUUID(),
            });
          }}
        >
          <SyncLock variant="button" />
          <div class="buttonText">
            <span>
              {strings["regenerateInviteLink"]}
            </span>
            <span class="buttonBody">
              {strings["theCurrentInvitationLinkWillNoLongerWork"]}
            </span>
          </div>
        </ListButton>
        <ListButton
          color="error"
          onclick={async () => {
            await deleteBill(app, billData);
          }}
        >
          <Delete variant="button" />
          <div class="buttonText">
            <span>
              {strings["deleteBill"]}
            </span>
            <span class="buttonBody">
              {strings["thisWillDeleteTheBillForAllUsers"]}
            </span>
          </div>
        </ListButton>
      {:else}
        <ListButton
          color="error"
          onclick={async () => {
            if (app.user.data?.id) {
              await leaveBill(billData, app.user.data.id);
            }
          }}
        >
          <Door variant="button" />
          <div class="buttonText">
            <span>
              {strings["leaveBill"]}
            </span>
            <span class="buttonBody">
              {strings["youWillNotBeAbleToAccessThisBillAnymore"]}
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

  .bill {
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
