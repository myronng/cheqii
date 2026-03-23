<script lang="ts">
  import MainCallToAction from "$lib/components/main/MainCallToAction.svelte";
  import MainHeader from "$lib/components/main/MainHeader.svelte";
  import MainListing from "$lib/components/main/MainListing.svelte";
  import { getAppContext } from "$lib/utils/common/context.svelte";
  import { type BillData } from "$lib/utils/models/bill.svelte";
  import { untrack } from "svelte";

  let { data } = $props();
  const { bills, user } = getAppContext();
  const serverBills = untrack(() => data.billList ?? []);
  let billList = $state(serverBills);

  $effect(() => {
    if (user.data) {
      /**
       * Reconcile the data coming from the server against the data in client IDB.
       * Employ last write wins. We only merge server bills if haven't initialized locally yet,
       * or if they are genuinely new (not in our local set).
       */
      const localBills = bills.data ?? [];
      const mergedBillsMap = new Map<string, BillData>();

      // 1. Start with local bills (Source of Truth)
      for (const bill of localBills) {
        mergedBillsMap.set(bill.id, bill);
      }

      // Only add server bills if local data hasn't been initialized yet.
      // This ensures that once local data is established (e.g. from IndexedDB),
      // it takes precedence, preventing deleted bills from re-appearing from the server.
      if (!bills.initialized) {
        for (const bill of serverBills) {
          if (!mergedBillsMap.has(bill.id)) {
            mergedBillsMap.set(bill.id, bill);
          }
        }
      }

      const mergedBills = Array.from(mergedBillsMap.values());
      mergedBills.sort(
        (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at),
      );
      billList = mergedBills;
    }
  });
</script>

<MainHeader strings={data.strings} supabase={data.supabase} />
<main>
  <MainCallToAction strings={data.strings} />
  {#if billList}
    <MainListing {billList} strings={data.strings} />
  {/if}
</main>

<style>
  main {
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--length-spacing) * 2);
    padding: calc(var(--length-spacing) * 2);
  }
</style>
