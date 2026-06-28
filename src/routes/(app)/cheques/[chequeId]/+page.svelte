<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import Dialog from "$lib/components/base/Dialog.svelte";
  import Loader from "$lib/components/base/Loader.svelte";
  import EntryCards from "$lib/components/entry/EntryCards.svelte";
  import EntryGrid from "$lib/components/entry/EntryGrid.svelte";
  import EntryHeader from "$lib/components/entry/EntryHeader.svelte";
  import EntryPayments from "$lib/components/entry/EntryPayments.svelte";
  import EntrySettings from "$lib/components/entry/EntrySettings.svelte";
  import EntrySummary from "$lib/components/entry/EntrySummary.svelte";
  import { allocate } from "$lib/domain/allocate";
  import { settle } from "$lib/domain/settle";
  import { getAppContext } from "$lib/state/app.svelte";
  import { allocationInput } from "$lib/state/model";
  import { AMOUNT_FORMATTER, AMOUNT_SCALE } from "$lib/utils/common/formatter";
  import { MOBILE_QUERY, mediaQuery } from "$lib/utils/common/media.svelte";

  // Below 768px the editor is a vertical card stack (EntryCards) with the settle-up
  // in a bottom sheet; at/above it's the spreadsheet grid with inline settle-up.
  const isMobile = mediaQuery(MOBILE_QUERY);

  let { data } = $props();
  const app = getAppContext();

  // Discriminated load state — never an unbounded spinner (frontend spec §3.2).
  let status = $state<"loading" | "ready" | "not_found" | "error">("loading");

  $effect(() => {
    const id = data.chequeId;
    status = "loading";
    app.cheques.ensureLoaded(id).then((res) => {
      if (res.status === "not_found") {
        void goto("/cheques"); // lost access / never existed → purge + app home
        return;
      }
      status = res.status; // "ready" | "error"
    });
  });

  // Single source of truth: the live store snapshot (updated by sync + actions).
  const chequeData = $derived(app.cheques.byId(data.chequeId));

  const allocations = $derived.by(() => {
    if (!chequeData) return null;
    const input = allocationInput(chequeData);
    return allocate(input.people, input.items);
  });
  const settlement = $derived(allocations ? settle(allocations) : null);

  // Cheques are currency-agnostic: a single shared decimal formatter (no symbol)
  // and a fixed minor-unit scale, instead of a per-cheque currency.
  const currencyFormatter = AMOUNT_FORMATTER;
  const currencyFactor = AMOUNT_SCALE;

  const url = $derived(`${data.origin}/cheques/${data.chequeId}`);
  const userId = $derived(app.user.data?.id ?? "");

  // The person-balance modal is driven by the URL hash `#c-<id>` so Back
  // closes it (and it survives reload). Resolve the id back to a stable index;
  // a stale/unknown id (e.g. a deleted person) yields -1 → modal closed.
  const personSummaryIndex = $derived.by(() => {
    const match = page.url.hash.match(/^#c-(.+)$/);
    if (!match || !chequeData) return -1;
    return chequeData.cheque_people.findIndex((c) => c.id === match[1]);
  });
</script>

{#if status === "ready" && chequeData && allocations && settlement && currencyFormatter}
  <EntryHeader {chequeData} session={data.session} strings={data.strings} supabase={data.supabase} {url} />
  <main style:--content={`1fr repeat(${2 + chequeData.cheque_people.length}, min-content)`}>
    {#if isMobile.current}
      <EntryCards
        {allocations}
        {chequeData}
        {currencyFactor}
        {currencyFormatter}
        {settlement}
        strings={data.strings}
        {userId}
      />
    {:else}
      <EntryGrid
        {allocations}
        {chequeData}
        {currencyFactor}
        {currencyFormatter}
        strings={data.strings}
        {userId}
      />
      <EntryPayments {chequeData} {currencyFormatter} {settlement} strings={data.strings} {userId} />
    {/if}

    <EntrySummary
      {allocations}
      {chequeData}
      {personSummaryIndex}
      {currencyFormatter}
      strings={data.strings}
    />
    <EntrySettings {chequeData} {currencyFactor} strings={data.strings} {url} {userId} />

    {#if isMobile.current}
      <Dialog hash="settle" strings={data.strings} title={data.strings["settleUp"]}>
        <EntryPayments
          {chequeData}
          {currencyFormatter}
          embedded
          {settlement}
          strings={data.strings}
          {userId}
        />
      </Dialog>
    {/if}
  </main>
{:else if status === "error"}
  <div class="message">
    <p>{data.strings["appName"]}</p>
    <Button variant="primary" onclick={() => app.cheques.ensureLoaded(data.chequeId)}>
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
