<script lang="ts">
  import Button from "$lib/components/base/buttons/Button.svelte";
  import EntryInput from "$lib/components/entry/EntryInput.svelte";
  import EntrySelect from "$lib/components/entry/EntrySelect.svelte";
  import Copy from "$lib/components/icons/Copy.svelte";
  import Link from "$lib/components/icons/Link.svelte";
  import type { Settlement } from "$lib/domain/settle";
  import { updateChequeUser, updateContributor, updateUser } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";
  import type { ChequeData } from "$lib/state/model";
  import { getNumericDisplay } from "$lib/utils/common/formatter";
  import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";

  let {
    chequeData,
    currencyFormatter,
    settlement,
    strings,
    userId,
  }: {
    chequeData: ChequeData;
    currencyFormatter: Intl.NumberFormat;
    settlement: Settlement;
    strings: LocalizedStrings;
    userId: string;
  } = $props();

  const app = getAppContext();
  const PAYMENT_METHODS = ["etransfer", "payPal"] as const;
  const paymentMethods = PAYMENT_METHODS.map((type) => ({ id: type, name: strings[type] }));

  // The auth user that a contributor slot belongs to (creator's slot id === userId;
  // others link via linked_user_id).
  const ownerUserId = (index: number) => {
    const c = chequeData.cheque_contributors[index];
    return c?.linked_user_id ?? c?.id ?? "";
  };

  // Group the pure settlement transfers into per-payee payment lines.
  const lines = $derived.by(() => {
    const contributors = chequeData.cheque_contributors;
    const grouped = new Map<number, { payee: string; payments: string[] }>();
    for (const t of settlement.transfers) {
      const entry = grouped.get(t.toIndex) ?? {
        payee: contributors[t.toIndex]?.name ?? strings["anonymous"],
        payments: [],
      };
      entry.payments.push(
        interpolateString(strings["{payer}Sends{payee}{value}"], {
          payee: contributors[t.toIndex]?.name ?? strings["anonymous"],
          payer: contributors[t.fromIndex]?.name ?? strings["anonymous"],
          value: getNumericDisplay(currencyFormatter, t.amount),
        }),
      );
      grouped.set(t.toIndex, entry);
    }
    return grouped;
  });

  const unaccounted = $derived(
    settlement.owingUnaccounted + settlement.paidUnaccounted > 0
      ? interpolateString(strings["{value}UnaccountedFor"], {
          value: getNumericDisplay(
            currencyFormatter,
            settlement.owingUnaccounted + settlement.paidUnaccounted,
          ),
        })
      : null,
  );

  const isAuthenticatedUserLinked = $derived(
    chequeData.cheque_contributors.some((c) => c.id === userId || c.linked_user_id === userId),
  );
</script>

{#if settlement.transfers.length > 0 || unaccounted}
  <section class="container">
    {#each lines as [contributorIndex, { payee, payments }], iteration}
      {@const linkedUserId = ownerUserId(contributorIndex)}
      {@const chequeUser = chequeData.cheque_users.find((bu) => bu.user_id === linkedUserId)}
      {@const isMine = linkedUserId === userId}
      {#if iteration !== 0}
        <hr />
      {/if}
      <article class="line">
        <div class="payments">
          {#each payments as payment}
            <span>{payment}</span>
          {/each}
        </div>
        {#if chequeUser?.payment_id && chequeUser.payment_method && !isMine}
          <span class="separator">•</span>
          <div class="account details">
            <span class="method">{strings[chequeUser.payment_method]}</span>
            <span class="separator">•</span>
            <Button
              borderless
              onclick={() => {
                if (chequeUser.payment_id) navigator.clipboard.writeText(chequeUser.payment_id);
              }}
              padding={0.5}
            >
              <Copy />
              {chequeUser.payment_id}
            </Button>
          </div>
        {:else if !isAuthenticatedUserLinked}
          <span class="separator">•</span>
          <div class="account">
            <Button
              borderless
              onclick={async () => {
                const contributorId = chequeData.cheque_contributors[contributorIndex].id;
                await updateContributor(app, chequeData.id, {
                  id: contributorId,
                  linked_user_id: userId,
                });
                if (app.user.data?.default_payment_id || app.user.data?.default_payment_method) {
                  await updateChequeUser(app, chequeData.id, {
                    payment_id: app.user.data.default_payment_id ?? null,
                    payment_method: app.user.data.default_payment_method ?? undefined,
                    userId,
                  });
                }
              }}
              padding={0.5}
            >
              <Link />
              {interpolateString(strings["linkPaymentAccountTo{payee}"], { payee })}
            </Button>
          </div>
        {:else if isMine}
          <span class="separator">•</span>
          <div class="account details editable">
            <EntrySelect
              onchange={async (e) => {
                const value = e.currentTarget.value as (typeof PAYMENT_METHODS)[number];
                await updateChequeUser(app, chequeData.id, { payment_method: value, userId });
                await updateUser(app, { default_payment_method: value });
              }}
              options={paymentMethods}
              title={strings["paymentMethod"]}
              value={chequeUser?.payment_method}
            />
            <span class="separator">•</span>
            <EntryInput
              inputmode="email"
              onchange={async (e) => {
                const value = e.currentTarget.value;
                await updateChequeUser(app, chequeData.id, { payment_id: value, userId });
                await updateUser(app, { default_payment_id: value });
              }}
              placeholder={strings["paymentId"]}
              title={strings["paymentId"]}
              value={chequeUser?.payment_id}
            />
          </div>
        {:else}
          <span class="separator">•</span>
          <div class="account inactive">
            {interpolateString(strings["{user}HasNoPaymentAccountSetUp"], { user: payee })}
          </div>
        {/if}
      </article>
    {/each}
    {#if unaccounted}
      <article class="line">{unaccounted}</article>
    {/if}
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
      margin: var(--space-2);
      inline-size: calc(100% - var(--space-2) * 2);
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
      margin-block: var(--space-2);
      margin-inline: auto;
    }

    .line {
      align-items: center;
    }

    .separator {
      color: var(--color-text-muted);
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
    border-block-start: var(--border-divider) dashed var(--color-border);
    grid-column: 1 / -1;
  }

  .container {
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    display: grid;
    min-block-size: fit-content;
    font-family: JetBrains Mono;
    gap: var(--space-2) calc(var(--space-2) * 2);
    left: var(--space-2);
    overflow-x: auto;
    padding: var(--space-2);
    position: sticky;
    right: var(--space-2);

    &:not(:has(.line)) {
      display: none;
    }
  }

  .details {
    align-items: center;

    &:not(.editable) {
      color: var(--color-text-muted);
    }
  }

  .editable {
    color: var(--color-action);
  }

  .inactive {
    color: var(--color-text-inactive);
  }

  .line {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
  }

  .method {
    padding-block: calc(var(--space-2) * 0.5);
    padding-inline: var(--space-2);
  }

  .payments {
    display: flex;
    flex-direction: column;
    gap: calc(var(--space-2) * 0.5);
  }
</style>
