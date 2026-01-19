<script lang="ts">
  import Loader from "$lib/components/base/Loader.svelte";
  import EntryGrid from "$lib/components/entry/EntryGrid.svelte";
  import EntryHeader from "$lib/components/entry/EntryHeader.svelte";
  import EntryPayments from "$lib/components/entry/EntryPayments.svelte";
  import EntrySettings from "$lib/components/entry/EntrySettings.svelte";
  import EntrySummary from "$lib/components/entry/EntrySummary.svelte";
  import { allocate } from "$lib/utils/common/allocate";
  import { getAppContext } from "$lib/utils/common/context.svelte";
  import { CURRENCY_FORMATTER } from "$lib/utils/common/formatter";
  import { untrack } from "svelte";

  let { data } = $props();
  const { bills, user } = getAppContext();
  const serverBillData = untrack(() => data.bill);
  let billData = $state(serverBillData);

  $effect(() => {
    const clientBillData = bills.data?.find((b) => b.id === billData.id);
    if (clientBillData) {
      if (clientBillData.updated_at > serverBillData.updated_at) {
        billData = clientBillData;
      } else {
        bills.update(billData);
      }
    } else {
      // Fire and forget - this assumes a desync between server and client caused by offline mode
      user.update({
        bills: user.data?.bills.concat(billData.id) ?? [billData.id],
      });
      bills.update(billData);
    }
  });

  const allocations = $derived(
    billData ? allocate(billData.bill_contributors, billData.bill_items) : null,
  );
  const url = $derived(
    `${data.origin}${billData?.invite_required ? `/invite/${billData.invite_id}/${billData.id}` : `/bills/${billData.id}`}`,
  );
  const billUser = $derived(
    billData && user.data
      ? billData.bill_users.find(
          (billUsersData) => billUsersData.user_id === user.data?.id,
        )
      : null,
  );
  let contributorSummaryIndex = $state(-1);

  const currencyFactor = Math.pow(
    10,
    CURRENCY_FORMATTER.resolvedOptions().maximumFractionDigits ?? 2,
  );
</script>

{#if billData && allocations}
  <EntryHeader bind:billData strings={data.strings} {url} />
  <main
    style:--content={`1fr repeat(${2 + billData.bill_contributors.length}, min-content)`}
  >
    <EntryGrid
      {allocations}
      bind:billData
      bind:contributorSummaryIndex
      {currencyFactor}
      currencyFormatter={CURRENCY_FORMATTER}
      strings={data.strings}
      userId={user.data?.id ?? ""}
    />
    <EntryPayments
      {allocations}
      bind:billData
      currencyFormatter={CURRENCY_FORMATTER}
      strings={data.strings}
      userId={user.data?.id ?? ""}
    />
    <EntrySummary
      {allocations}
      {billData}
      {contributorSummaryIndex}
      currencyFormatter={CURRENCY_FORMATTER}
      strings={data.strings}
    />
    {#if billUser?.authority === "owner"}
      <EntrySettings
        bind:billData
        {currencyFactor}
        strings={data.strings}
        {url}
        userId={user.data?.id ?? ""}
      />
    {/if}
  </main>
{:else}
  <div class="loader">
    <Loader />
  </div>
{/if}

<style>
  main {
    display: flex;
    flex: 1;
    flex-direction: column;
    position: relative;
  }

  .loader {
    align-items: center;
    display: flex;
    flex: 1;
    justify-content: center;
  }
</style>
