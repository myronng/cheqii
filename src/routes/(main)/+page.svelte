<script lang="ts">
  import type { BillData } from "$lib/utils/models/bill.svelte";
  import type { AppUser } from "$lib/utils/models/user.svelte";

  import MainCallToAction from "$lib/components/main/mainCallToAction.svelte";
  import MainHeader from "$lib/components/main/mainHeader.svelte";
  import MainListing from "$lib/components/main/mainListing.svelte";
  import { idb } from "$lib/utils/common/indexedDb.svelte";
  import { untrack } from "svelte";

  let { data } = $props();
  const serverBills = untrack(() => data.billList ?? []);
  let billList = $state(serverBills);

  $effect(() => {
    idb?.get<AppUser>("users", data.userId).then(async (user) => {
      if (user) {
        /**
         * Reconcile the data coming from the server against the data in client IDB.
         * Employ last write wins
         */
        const clientBills = (await idb?.getAll<BillData>("bills")) ?? [];
        const allBills = serverBills.concat(clientBills);
        const mergedBillsMap = new Map<string, BillData>();

        for (const bill of allBills) {
          const existing = mergedBillsMap.get(bill.id);
          // Handle cases where user access is removed while offline
          if (
            (!existing || bill.updated_at > existing.updated_at) &&
            bill.bill_users.some((billUser) => user.id === billUser.user_id)
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
  });
</script>

<MainHeader
  strings={data.strings}
  supabase={data.supabase}
  userId={data.userId}
/>
<main>
  <MainCallToAction strings={data.strings} userId={data.userId} />
  {#if billList}
    <MainListing {billList} strings={data.strings} />
  {/if}
</main>

<style>
  /* @media screen and (max-width: 768px) {
		main {
		}
	} */
  main {
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--length-spacing) * 2);
    padding: calc(var(--length-spacing) * 2);
  }
</style>
