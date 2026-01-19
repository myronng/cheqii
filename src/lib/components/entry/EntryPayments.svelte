<script lang="ts">
  import type { Allocations } from "$lib/utils/common/allocate";
  import {
    type BillData,
    linkContributorAccount,
    updateUserPayment,
  } from "$lib/utils/models/bill.svelte";

  import Button from "$lib/components/base/buttons/Button.svelte";
  import EntryInput from "$lib/components/entry/EntryInput.svelte";
  import EntrySelect from "$lib/components/entry/EntrySelect.svelte";
  import Copy from "$lib/components/icons/Copy.svelte";
  import Link from "$lib/components/icons/Link.svelte";
  import { getAppContext } from "$lib/utils/common/context.svelte";
  import { getNumericDisplay } from "$lib/utils/common/formatter";
  import { MaxHeap } from "$lib/utils/common/heap";
  import {
    type LocalizedStrings,
    interpolateString,
  } from "$lib/utils/common/locale";
  import {
    type UserData,
    PAYMENT_METHODS,
  } from "$lib/utils/models/user.svelte";

  let {
    allocations,
    billData = $bindable(),
    currencyFormatter,
    strings,
    userId,
  }: {
    allocations: Allocations;
    billData: BillData;
    currencyFormatter: Intl.NumberFormat;
    strings: LocalizedStrings;
    userId: UserData["id"];
  } = $props();

  const app = getAppContext();

  const paymentMethods = PAYMENT_METHODS.map((type) => ({
    id: type,
    name: strings[type],
  }));
  const getAllocationStrings = (allocations: Allocations) => {
    const allocationStrings: Map<
      number,
      { payee: string; payments: string[] }
    > = new Map();
    const unaccountedStrings: string[] = [];
    const contributors = billData.bill_contributors;
    const owingHeap = new MaxHeap();
    const paidHeap = new MaxHeap();
    for (const [index, contribution] of allocations.contributions) {
      const balance = contribution.paid.total - contribution.owing.total;
      if (balance > 0) {
        paidHeap.insert({ index, value: balance });
      } else if (balance < 0) {
        owingHeap.insert({ index, value: Math.abs(balance) });
      }
    }
    let currentOwing = owingHeap.extractMax();
    let currentPaid;
    while ((currentOwing?.value ?? 0) > 0) {
      if (!currentPaid?.value) {
        currentPaid = paidHeap.extractMax();
      }
      if (currentPaid && currentOwing) {
        const currentAllocationString = allocationStrings.get(
          currentPaid.index,
        );
        let payments: string[] = [];
        if (!currentAllocationString) {
          allocationStrings.set(currentPaid.index, {
            payee: contributors[currentPaid.index].name,
            payments,
          });
        } else {
          payments = currentAllocationString.payments;
        }
        if (currentPaid.value >= currentOwing.value) {
          payments.push(
            interpolateString(strings["{payer}Sends{payee}{value}"], {
              payee: contributors[currentPaid.index].name,
              payer: contributors[currentOwing.index].name,
              value: getNumericDisplay(currencyFormatter, currentOwing.value),
            }),
          );
          currentPaid.value -= currentOwing.value;
          currentOwing.value = 0;
        } else {
          payments.push(
            interpolateString(strings["{payer}Sends{payee}{value}"], {
              payee: contributors[currentPaid.index].name,
              payer: contributors[currentOwing.index].name,
              value: getNumericDisplay(currencyFormatter, currentPaid.value),
            }),
          );
          currentOwing.value -= currentPaid.value;
          currentPaid.value = 0;
        }
      } else {
        const unaccountedValue = currentPaid?.value ?? currentOwing?.value ?? 0;
        if (unaccountedValue) {
          unaccountedStrings.push(
            interpolateString(strings["{value}UnaccountedFor"], {
              value: getNumericDisplay(currencyFormatter, unaccountedValue),
            }),
          );
        }
        if (currentOwing) {
          currentOwing.value = 0;
        }
        if (currentPaid) {
          currentPaid.value = 0;
        }
      }
      if (!currentOwing?.value) {
        currentOwing = owingHeap.extractMax();
      }
    }
    return { allocationStrings, unaccountedStrings };
  };
</script>

{#if allocations !== null}
  {@const { allocationStrings, unaccountedStrings } =
    getAllocationStrings(allocations)}
  {@const isAuthenticatedUserLinked = billData.bill_contributors.some(
    ({ id }) => id === userId,
  )}
  <section class="container">
    {#each allocationStrings as [contributorIndex, { payee, payments }], iteration}
      {@const currentUserId = billData.bill_contributors[contributorIndex].id}
      {@const billUser = billData.bill_users.find(
        (bu) => bu.user_id === currentUserId,
      )}
      {#if iteration !== 0}
        <hr />
      {/if}
      <article class="line">
        <div class="payments">
          {#each payments as payment}
            <span>
              {payment}
            </span>
          {/each}
        </div>
        {#if billUser?.payment_id && billUser.payment_method && currentUserId !== userId}
          <span class="separator">•</span>
          <div class="account details">
            <span class="method">{strings[billUser.payment_method]}</span>
            <span class="separator">•</span>
            <Button
              borderless
              onclick={() => {
                if (billUser.payment_id) {
                  navigator.clipboard.writeText(billUser.payment_id);
                }
              }}
              padding={0.5}
            >
              <Copy />
              {billUser.payment_id}
            </Button>
          </div>
        {:else if !isAuthenticatedUserLinked}
          <span class="separator">•</span>
          <div class="account">
            <Button
              borderless
              onclick={async () => {
                const originalContributorId =
                  billData.bill_contributors[contributorIndex].id;

                await linkContributorAccount(app, billData, {
                  newUserId: userId,
                  oldContributorId: originalContributorId,
                  userInfo: {
                    default_payment_id:
                      app.user.data?.default_payment_id || undefined,
                    default_payment_method:
                      app.user.data?.default_payment_method || undefined,
                  },
                });
              }}
              padding={0.5}
            >
              <Link />
              {interpolateString(strings["linkPaymentAccountTo{payee}"], {
                payee,
              })}
            </Button>
          </div>
        {:else if currentUserId === userId}
          <span class="separator">•</span>
          <div class="account details editable">
            <EntrySelect
              onchange={async (e) => {
                const value = e.currentTarget
                  .value as (typeof paymentMethods)[number]["id"];
                await updateUserPayment(app, billData, {
                  paymentMethod: value,
                  userId,
                });
              }}
              options={paymentMethods}
              title={strings["paymentMethod"]}
              value={billUser?.payment_method}
            />
            <span class="separator">•</span>
            <EntryInput
              inputmode="email"
              onchange={async (e) => {
                const value = e.currentTarget.value;
                await updateUserPayment(app, billData, {
                  paymentId: value,
                  userId,
                });
              }}
              placeholder={strings["paymentId"]}
              title={strings["paymentId"]}
              value={billUser?.payment_id}
            />
          </div>
        {:else}
          <span class="separator">•</span>
          <div class="account inactive">
            {interpolateString(strings["{user}HasNoPaymentAccountSetUp"], {
              user:
                billData.bill_contributors.find(
                  ({ id }) => id === currentUserId,
                )?.name || strings["anonymous"],
            })}
          </div>
        {/if}
      </article>
    {/each}
    {#each unaccountedStrings as unaccounted}
      <article class="line">
        {unaccounted}
      </article>
    {/each}
  </section>
{/if}

<style>
  @media screen and (max-width: 768px) {
    .account.details {
      display: flex;
      flex-wrap: wrap;
    }

    .container {
      grid-template-columns: 1fr;
      margin: var(--length-spacing);
      inline-size: calc(100% - var(--length-spacing) * 2);
    }

    .line {
      justify-content: start;
    }

    .separator {
      display: none;
    }
  }

  @media screen and (min-width: 769px) {
    .container {
      grid-template-columns: max-content min-content max-content min-content min-content;
      margin-block: var(--length-spacing);
      margin-inline: auto;
    }

    .line {
      align-items: center;
    }

    .separator {
      color: var(--color-font-disabled);
    }

    .account {
      grid-column: 3 / -1;

      &.details {
        display: grid;
        grid-template-columns: subgrid;
        justify-content: space-between;
      }
    }
  }

  hr {
    border: 0;
    border-block-start: var(--length-divider) dashed var(--color-divider);
    grid-column: 1 / -1;
  }

  .container {
    border: var(--length-divider) solid var(--color-divider);
    border-radius: var(--length-radius);
    display: grid;
    min-block-size: fit-content;
    font-family: JetBrains Mono;
    gap: var(--length-spacing) calc(var(--length-spacing) * 2);
    left: var(--length-spacing);
    overflow-x: auto;
    padding: var(--length-spacing);
    position: sticky;
    right: var(--length-spacing);

    &:not(:has(.line)) {
      display: none;
    }
  }

  .details {
    align-items: center;

    &:not(.editable) {
      color: var(--color-font-disabled);
    }
  }

  .editable {
    color: var(--color-primary);
  }

  .inactive {
    color: var(--color-font-inactive);
  }

  .line {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
  }

  .method {
    padding-block: calc(var(--length-spacing) * 0.5);
    padding-inline: var(--length-spacing);
  }

  .payments {
    display: flex;
    flex-direction: column;
    gap: calc(var(--length-spacing) * 0.5);
  }
</style>
