<script lang="ts">
  import { goto } from "$app/navigation";
  import Loader from "$lib/components/base/loader.svelte";
  import EntryGrid from "$lib/components/entry/entryGrid.svelte";
  import EntryHeader from "$lib/components/entry/entryHeader.svelte";
  import EntryPayments from "$lib/components/entry/entryPayments.svelte";
  import EntrySettings from "$lib/components/entry/entrySettings.svelte";
  import EntrySummary from "$lib/components/entry/entrySummary.svelte";
  import { allocate } from "$lib/utils/common/allocate";
  import { CURRENCY_FORMATTER } from "$lib/utils/common/formatter";
  import { idb } from "$lib/utils/common/indexedDb.svelte.js";
  import {
    type BillAuthority,
    type BillData,
    type OnBillChange,
    INVITE_ACCESS,
  } from "$lib/utils/models/bill.svelte.js";
  import { type OnUserChange, getUser } from "$lib/utils/models/user.svelte";
  import { untrack } from "svelte";

  let { data } = $props();
  let billData = $state(untrack(() => data.bill));
  const allocations = $derived(
    billData ? allocate(billData.bill_contributors, billData.bill_items) : null
  );
  const url = $derived(
    `${data.origin}${billData?.invite_required ? `/invite/${billData.invite_id}/${data.bill.id}` : `/bills/${data.bill.id}`}`
  );
  const billUser = $derived(
    billData
      ? billData.bill_users.find(
          (billUsersData) => billUsersData.user_id === data.userId
        )
      : null
  );
  let contributorSummaryIndex = $state(-1);

  const authorizeBill = async (currentBillData: BillData) => {
    const currentBillUser = currentBillData.bill_users.find(
      (billUsersData) => billUsersData.user_id === data.userId
    );
    if (
      currentBillData.invite_required &&
      (!currentBillUser || !INVITE_ACCESS.has(currentBillUser?.authority)) &&
      !data.invited
    ) {
      // Invite required but user doesn't have access
      const user = await getUser(data.userId);
      onUserChange({
        bills:
          user.get?.bills.filter((bill) => bill !== currentBillData.id) ?? [],
      });
      goto("/");
    } else {
      // Invite not required or user has access
      const user = await getUser(data.userId);
      const userBills = user.get?.bills;
      const transactions: Promise<void>[] = [];
      if (!userBills?.includes(currentBillData.id)) {
        transactions.push(
          onUserChange({
            bills: (userBills ?? []).concat(currentBillData.id),
          })
        );
      }

      let userAccess: BillAuthority | null = null;
      if (!currentBillData.invite_required && !currentBillUser) {
        // Add user to bill if publicly available and user doesn't already exist
        userAccess = "public";
      } else if (
        currentBillData.invite_required &&
        data.invited &&
        (!currentBillUser || !INVITE_ACCESS.has(currentBillUser?.authority))
      ) {
        // Granted invited authority if the user doesn't have it or a greater authority
        userAccess = "invited";
      }
      if (userAccess && currentBillUser) {
        currentBillUser.authority = userAccess;
        transactions.push(onBillChange(currentBillData));
      }
      await Promise.all(transactions);
    }
  };

  $effect(() => {
    if (!billData) {
      idb?.get<BillData>("bills", data.bill.id).then(async (bill) => {
        if (bill) {
          // Handle cases where user access is removed while in the bill
          await authorizeBill(bill);
          billData = bill;
        }
      });
    } else {
      authorizeBill(billData);
    }
  });

  const onBillChange: OnBillChange = async (newBillData) => {
    await idb?.put("bills", JSON.parse(JSON.stringify(newBillData)));
  };

  const onUserChange: OnUserChange = async (newUserData) => {
    const user = await getUser(data.userId);
    await user.set(newUserData);
  };

  const currencyFactor = Math.pow(
    10,
    CURRENCY_FORMATTER.resolvedOptions().maximumFractionDigits ?? 2
  );
</script>

{#if billData && allocations}
  <EntryHeader
    bind:billData
    {onBillChange}
    strings={data.strings}
    supabase={data.supabase}
    {url}
  />
  <main
    style:--content={`1fr repeat(${2 + billData.bill_contributors.length}, min-content)`}
  >
    <EntryGrid
      {allocations}
      bind:billData
      bind:contributorSummaryIndex
      {currencyFactor}
      currencyFormatter={CURRENCY_FORMATTER}
      {onBillChange}
      strings={data.strings}
      supabase={data.supabase}
      userId={data.userId}
    />
    <EntryPayments
      {allocations}
      bind:billData
      currencyFormatter={CURRENCY_FORMATTER}
      {onBillChange}
      {onUserChange}
      strings={data.strings}
      supabase={data.supabase}
      userId={data.userId}
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
        {onBillChange}
        {onUserChange}
        strings={data.strings}
        supabase={data.supabase}
        {url}
        userId={data.userId}
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
