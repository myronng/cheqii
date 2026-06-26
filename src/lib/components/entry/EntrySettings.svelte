<script lang="ts">
  import ListButton from "$lib/components/base/buttons/ListButton.svelte";
  import ToggleButton from "$lib/components/base/buttons/ToggleButton.svelte";
  import Dialog from "$lib/components/base/Dialog.svelte";
  import Input from "$lib/components/base/Input.svelte";
  import EntryInput from "$lib/components/entry/EntryInput.svelte";
  import EntrySelect from "$lib/components/entry/EntrySelect.svelte";
  import EntryShare from "$lib/components/entry/EntryShare.svelte";
  import Delete from "$lib/components/icons/Delete.svelte";
  import Door from "$lib/components/icons/Door.svelte";
  import Download from "$lib/components/icons/Download.svelte";
  import Link from "$lib/components/icons/Link.svelte";
  import Lock from "$lib/components/icons/Lock.svelte";
  import Unlink from "$lib/components/icons/Unlink.svelte";
  import Unlock from "$lib/components/icons/Unlock.svelte";
  import { deleteBill, leaveBill, updateBill } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";
  import type { BillData } from "$lib/state/model";
  import { CURRENCY_MAX, CURRENCY_MIN, getNumericDisplay } from "$lib/utils/common/formatter";
  import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";

  let {
    billData,
    currencyFactor,
    currencyFormatter,
    strings,
    url,
    userId,
  }: {
    billData: BillData;
    currencyFactor: number;
    currencyFormatter: Intl.NumberFormat;
    strings: LocalizedStrings;
    url: string;
    userId: string;
  } = $props();

  const app = getAppContext();
  const billUser = $derived(billData.bill_users.find(({ user_id }) => user_id === userId));

  // Common ISO-4217 currencies; the bill stores the code and the formatter is
  // re-derived from it on the bill page (per-bill currency, data-model spec).
  const CURRENCIES = ["CAD", "USD", "EUR", "GBP", "JPY", "AUD", "CHF", "CNY", "INR", "MXN"];
  const currencyOptions = CURRENCIES.map((code) => ({ id: code, name: code }));

  // v2 roles → existing locale keys (precise editor/viewer labels arrive with i18n, 5.6).
  const roleLabel = (role: "owner" | "editor" | "viewer") =>
    role === "owner" ? strings["owner"] : role === "editor" ? strings["invited"] : strings["public"];

  const formatCsv = (data: string) => {
    const newData = data.replaceAll(/"/g, '""');
    if (newData.includes(",") || newData.includes("\n")) return `"${newData}"`;
    return newData;
  };
</script>

<Dialog id="settingsDialog" {strings} title={strings["settings"]}>
  <section class="settings">
    <fieldset class="access" disabled={billUser?.role !== "owner"}>
      <ToggleButton
        checked={billData.visibility === "private"}
        class="accessType"
        id="private"
        name="access"
        onchange={async () => {
          await updateBill(app, billData.id, { visibility: "private" });
        }}
        padding={2}
      >
        <div class="accessHeading">
          <Lock />
          <span>{strings["private"]}</span>
        </div>
        <span class="accessDescription">{strings["onlyInvitedUsersCanAccessThisBill"]}</span>
      </ToggleButton>
      <ToggleButton
        checked={billData.visibility === "public_read"}
        class="accessType"
        id="public"
        name="access"
        onchange={async () => {
          await updateBill(app, billData.id, { visibility: "public_read" });
        }}
        padding={2}
      >
        <div class="accessHeading">
          <Unlock />
          <span>{strings["public"]}</span>
        </div>
        <span class="accessDescription">{strings["anyoneOnTheInternetCanAccessThisBill"]}</span>
      </ToggleButton>
    </fieldset>
    <fieldset class="totals" disabled={billUser?.role !== "owner"}>
      <label class="field">
        <span>{strings["currency"]}</span>
        <EntrySelect
          isAlternate
          onchange={async (e) => {
            await updateBill(app, billData.id, { currency: e.currentTarget.value });
          }}
          options={currencyOptions}
          title={strings["currency"]}
          value={billData.currency}
        />
      </label>
      <label class="field">
        <span>{strings["tax"]}</span>
        <EntryInput
          formatter={currencyFormatter}
          inputmode="decimal"
          isAlternate
          max={CURRENCY_MAX}
          min={CURRENCY_MIN}
          onchange={async (e) => {
            await updateBill(app, billData.id, {
              tax: Number(e.currentTarget.value) * currencyFactor,
            });
          }}
          title={strings["tax"]}
          value={getNumericDisplay(currencyFormatter, billData.tax)}
        />
      </label>
      <label class="field">
        <span>{strings["tip"]}</span>
        <EntryInput
          formatter={currencyFormatter}
          inputmode="decimal"
          isAlternate
          max={CURRENCY_MAX}
          min={CURRENCY_MIN}
          onchange={async (e) => {
            await updateBill(app, billData.id, {
              tip: Number(e.currentTarget.value) * currencyFactor,
            });
          }}
          title={strings["tip"]}
          value={getNumericDisplay(currencyFormatter, billData.tip)}
        />
      </label>
    </fieldset>
    <fieldset class="invite">
      <Input readonly title={strings["inviteLink"]} value={url} />
      <EntryShare {strings} title={billData.name} {url} />
    </fieldset>
    <article class="users">
      <h2>{strings["users"]}</h2>
      {#each billData.bill_users as bu}
        {@const linkedContributorName = billData.bill_contributors.find(
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
    <article class="bill">
      <h2>{strings["bill"]}</h2>
      <ListButton
        onclick={() => {
          const csv = [
            [
              formatCsv(strings["item"]),
              formatCsv(strings["cost"]),
              formatCsv(strings["buyer"]),
              billData.bill_contributors.map((contributor) => formatCsv(contributor.name)),
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
                  billData.bill_item_splits
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
          tempLink.download = `${billData.name}.csv`;
          tempLink.href = csvUrl;
          document.body.appendChild(tempLink);
          tempLink.click();
          document.body.removeChild(tempLink);
        }}
      >
        <Download variant="button" />
        <div class="buttonText">
          <span>{strings["downloadCsv"]}</span>
          <span class="buttonBody">{strings["exportBillDataToUseInOtherApplications"]}</span>
        </div>
      </ListButton>
      <hr />
      {#if billUser?.role === "owner"}
        <ListButton
          color="error"
          onclick={async () => {
            await deleteBill(app, billData.id);
          }}
        >
          <Delete variant="button" />
          <div class="buttonText">
            <span>{strings["deleteBill"]}</span>
            <span class="buttonBody">{strings["thisWillDeleteTheBillForAllUsers"]}</span>
          </div>
        </ListButton>
      {:else}
        <ListButton
          color="error"
          onclick={async () => {
            await leaveBill(app, billData.id);
          }}
        >
          <Door variant="button" />
          <div class="buttonText">
            <span>{strings["leaveBill"]}</span>
            <span class="buttonBody">{strings["youWillNotBeAbleToAccessThisBillAnymore"]}</span>
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

  .totals {
    flex-wrap: wrap;

    .field {
      display: flex;
      flex: 1;
      flex-direction: column;
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
