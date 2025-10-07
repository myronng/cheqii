<script lang="ts">
  import { goto } from "$app/navigation";
  import Loader from "$lib/components/base/loader.svelte";
  import EntryGrid from "$lib/components/entry/entryGrid.svelte";
  import EntryHeader from "$lib/components/entry/entryHeader.svelte";
  import EntryPayments from "$lib/components/entry/entryPayments.svelte";
  import EntrySettings from "$lib/components/entry/entrySettings.svelte";
  import EntrySummary from "$lib/components/entry/entrySummary.svelte";
  import { allocate } from "$lib/utils/common/allocate";
  import {
    INVITE_ACCESS,
    type BillData,
    type BillUserAccess,
    type OnBillChange,
  } from "$lib/utils/common/bill.svelte.js";
  import { CURRENCY_FORMATTER } from "$lib/utils/common/formatter";
  import { idb } from "$lib/utils/common/indexedDb.svelte.js";
  import { getUser, type OnUserChange } from "$lib/utils/common/user.svelte";

  let { data } = $props();

  let billData = $state(data.bill);
  const allocations = $derived(
    billData ? allocate(billData.contributors, billData.items) : null,
  );
  const url = $derived(
    `${data.origin}${billData?.access.invite.required ? `/invite/${billData.access.invite.id}/${data.billId}` : `/bills/${data.billId}`}`,
  );
  let contributorSummaryIndex = $state(-1);

  const authorizeBill = async (currentBillData: BillData) => {
    if (data.user?.id) {
      if (
        currentBillData.access.invite.required &&
        !INVITE_ACCESS.has(
          currentBillData.access.users[data.user.id]?.authority,
        ) &&
        !data.invited
      ) {
        // Invite required but user doesn't have access
        const user = await getUser(data.user.id);
        onUserChange({
          bills:
            user.get?.bills.filter((bill) => bill !== currentBillData.id) ?? [],
        });
        goto("/");
      } else {
        // Invite not required or user has access
        const user = await getUser(data.user.id);
        const userBills = user.get?.bills;
        const transactions: Promise<void>[] = [];
        if (!userBills?.includes(currentBillData.id)) {
          transactions.push(
            onUserChange({
              bills: (userBills ?? []).concat(currentBillData.id),
            }),
          );
        }

        let userAccess: BillUserAccess | undefined;
        if (
          !currentBillData.access.invite.required &&
          !currentBillData.access.users[data.user.id]
        ) {
          // Add user to bill if publicly available and user doesn't already exist
          userAccess = {
            authority: "public",
          };
        } else if (
          currentBillData.access.invite.required &&
          data.invited &&
          (!currentBillData.access.users[data.user.id] ||
            !INVITE_ACCESS.has(
              currentBillData.access.users[data.user.id]?.authority,
            ))
        ) {
          // Granted invited authority if the user doesn't have it or a greater authority
          userAccess = {
            authority: "invited",
          };
        }
        if (userAccess) {
          if (user.get?.email) {
            userAccess.email = user.get.email;
          }
          if (user.get?.name) {
            userAccess.name = user.get.name;
          }
          if (user.get?.payment) {
            userAccess.payment = user.get.payment;
          }
          currentBillData.access.users[data.user.id] = userAccess;
          transactions.push(onBillChange(currentBillData));
        }
        await Promise.all(transactions);
      }
    }
  };

  $effect(() => {
    if (!billData) {
      idb?.get<BillData>("bills", data.billId).then(async (bill) => {
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
    newBillData.updatedAt = Date.now();
    await idb?.put("bills", JSON.parse(JSON.stringify(newBillData)));
  };

  const onUserChange: OnUserChange = async (userData) => {
    if (data.user?.id) {
      const user = await getUser(data.user.id);
      await user.set(userData);
    }
  };

  const currencyFactor = Math.pow(
    10,
    CURRENCY_FORMATTER.resolvedOptions().maximumFractionDigits ?? 2,
  );
</script>

{#if billData && allocations && data.user?.id}
  <EntryHeader bind:billData {onBillChange} strings={data.strings} {url} />
  <main
    style:--content={`1fr repeat(${2 + billData.contributors.length}, min-content)`}
  >
    <EntryGrid
      {allocations}
      bind:billData
      bind:contributorSummaryIndex
      {currencyFactor}
      currencyFormatter={CURRENCY_FORMATTER}
      {onBillChange}
      {onUserChange}
      strings={data.strings}
      userId={data.user.id}
    />
    <EntryPayments
      {allocations}
      bind:billData
      currencyFormatter={CURRENCY_FORMATTER}
      {onBillChange}
      {onUserChange}
      strings={data.strings}
      userId={data.user.id}
    />
    <EntrySummary
      {allocations}
      {billData}
      {contributorSummaryIndex}
      currencyFormatter={CURRENCY_FORMATTER}
      strings={data.strings}
    />
    {#if billData.access.users[data.user.id]?.authority === "owner"}
      <EntrySettings
        bind:billData
        {currencyFactor}
        {onBillChange}
        {onUserChange}
        strings={data.strings}
        {url}
        userId={data.user.id}
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
