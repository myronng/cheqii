<script lang="ts">
  import { goto } from "$app/navigation";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import Loader from "$lib/components/base/Loader.svelte";
  import EntryGrid from "$lib/components/entry/EntryGrid.svelte";
  import EntryHeader from "$lib/components/entry/EntryHeader.svelte";
  import EntryPayments from "$lib/components/entry/EntryPayments.svelte";
  import EntrySettings from "$lib/components/entry/EntrySettings.svelte";
  import EntrySummary from "$lib/components/entry/EntrySummary.svelte";
  import { allocate } from "$lib/domain/allocate";
  import { scale } from "$lib/domain/money";
  import { settle } from "$lib/domain/settle";
  import { getAppContext } from "$lib/state/app.svelte";
  import { allocationInput } from "$lib/state/model";

  let { data } = $props();
  const app = getAppContext();

  // Discriminated load state — never an unbounded spinner (frontend spec §3.2).
  let status = $state<"loading" | "ready" | "not_found" | "error">("loading");

  $effect(() => {
    const id = data.billId;
    status = "loading";
    app.bills.ensureLoaded(id).then((res) => {
      if (res.status === "not_found") {
        void goto("/"); // lost access / never existed → purge + home
        return;
      }
      status = res.status; // "ready" | "error"
    });
  });

  // Single source of truth: the live store snapshot (updated by sync + actions).
  const billData = $derived(app.bills.byId(data.billId));

  const allocations = $derived.by(() => {
    if (!billData) return null;
    const input = allocationInput(billData);
    return allocate(input.contributors, input.items, { tax: billData.tax, tip: billData.tip });
  });
  const settlement = $derived(allocations ? settle(allocations) : null);

  // Per-bill currency (allocation/data-model specs) — not a global CAD constant.
  const currencyFormatter = $derived(
    billData
      ? new Intl.NumberFormat("en-CA", {
          currency: billData.currency,
          currencyDisplay: "narrowSymbol",
          style: "currency",
        })
      : null,
  );
  const currencyFactor = $derived(billData ? scale(billData.currency) : 100);

  const url = $derived(`${data.origin}/bills/${data.billId}`);
  const userId = $derived(app.user.data?.id ?? "");
  let contributorSummaryIndex = $state(-1);
</script>

{#if status === "ready" && billData && allocations && settlement && currencyFormatter}
  <EntryHeader {billData} strings={data.strings} {url} />
  <main style:--content={`1fr repeat(${2 + billData.bill_contributors.length}, min-content)`}>
    <EntryGrid
      {allocations}
      {billData}
      bind:contributorSummaryIndex
      {currencyFactor}
      {currencyFormatter}
      strings={data.strings}
      {userId}
    />
    <EntryPayments {billData} {currencyFormatter} {settlement} strings={data.strings} {userId} />
    <EntrySummary
      {allocations}
      {billData}
      {contributorSummaryIndex}
      {currencyFormatter}
      strings={data.strings}
    />
    <EntrySettings
      {billData}
      {currencyFactor}
      {currencyFormatter}
      strings={data.strings}
      {url}
      {userId}
    />
  </main>
{:else if status === "error"}
  <div class="message">
    <p>{data.strings["appName"]}</p>
    <Button variant="primary" onclick={() => app.bills.ensureLoaded(data.billId)}>
      {data.strings["home"]}
    </Button>
  </div>
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

  .loader,
  .message {
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--space-4);
    justify-content: center;
  }
</style>
