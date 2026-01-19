<script lang="ts">
  import type { BillData } from "$lib/utils/models/bill.svelte";

  import MainCallToAction from "$lib/components/main/MainCallToAction.svelte";
  import MainHeader from "$lib/components/main/MainHeader.svelte";
  import MainListing from "$lib/components/main/MainListing.svelte";
  import { getAppContext } from "$lib/utils/common/context.svelte";
  import { untrack } from "svelte";

  let { data } = $props();
  const { bills, user } = getAppContext();
  const serverBills = untrack(() => data.billList ?? []);
  let billList = $state(serverBills);

  $effect(() => {
    if (user.data) {
      /**
       * Reconcile the data coming from the server against the data in client IDB.
       * Employ last write wins
       */
      const allBills = serverBills.concat(bills.data ?? []);
      const mergedBillsMap = new Map<string, BillData>();

      for (const bill of allBills) {
        const existing = mergedBillsMap.get(bill.id);
        // Handle cases where user access is removed while offline
        if (
          (!existing || bill.updated_at > existing.updated_at) &&
          bill.bill_users.some((billUser) => user.data?.id === billUser.user_id)
        ) {
          mergedBillsMap.set(bill.id, bill);
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
