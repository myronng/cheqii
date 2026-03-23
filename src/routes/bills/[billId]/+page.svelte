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
  import type { BillData } from "$lib/utils/models/bill.svelte";
  import { untrack } from "svelte";

  let { data } = $props();
  const { bills, user } = getAppContext();
  let billData = $state<BillData | null>(null);
  let loading = $state(true);

  // 1. Reactive Sync: Keep local view updated if global state changes (e.g. via Sync)
  $effect(() => {
    if (billData && bills.data) {
      const fromStore = bills.data.find((b) => b.id === data.billId);
      if (fromStore && fromStore.updated_at > billData.updated_at) {
        billData = fromStore;
      }
    }
  });

  // 2. Bootstrap / Hydration
  $effect(() => {
    const id = data.billId;
    // Don't re-run if we already have the right bill
    if (billData?.id === id) return;

    untrack(() => {
      loadBill(id);
    });
  });

  async function loadBill(id: string) {
    loading = true;
    billData = (await bills.ensureLoaded(id, user)) ?? null;
    loading = false;
  }

  const allocations = $derived(
    billData ? allocate(billData.bill_contributors, billData.bill_items) : null,
  );
  const url = $derived(
    `${data.origin}${billData?.invite_required ? `/invite/${billData?.invite_id}/${billData?.id}` : `/bills/${billData?.id}`}`,
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
    <EntrySettings
      bind:billData
      {currencyFactor}
      strings={data.strings}
      {url}
      userId={user.data?.id ?? ""}
    />
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
