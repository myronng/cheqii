<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Avatar from "$lib/components/base/Avatar.svelte";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import EntryInput from "$lib/components/entry/EntryInput.svelte";
  import EntrySelect from "$lib/components/entry/EntrySelect.svelte";
  import Copy from "$lib/components/icons/Copy.svelte";
  import Link from "$lib/components/icons/Link.svelte";
  import ReplaceUser from "$lib/components/icons/ReplaceUser.svelte";
  import Unlink from "$lib/components/icons/Unlink.svelte";
  import type { Settlement } from "$lib/domain/settle";
  import { updateChequeUser, updatePerson, updateUser } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";
  import type { ChequeData } from "$lib/state/model";
  import { getNumericDisplay } from "$lib/utils/common/formatter";
  import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";

  let {
    chequeData,
    currencyFormatter,
    embedded = false,
    settlement,
    strings,
    userId,
  }: {
    chequeData: ChequeData;
    currencyFormatter: Intl.NumberFormat;
    /** Inside the mobile settle sheet the Dialog supplies the title, so drop our
        own header + outer padding and render just the cards. */
    embedded?: boolean;
    settlement: Settlement;
    strings: LocalizedStrings;
    userId: string;
  } = $props();

  const app = getAppContext();
  const PAYMENT_METHODS = ["etransfer", "payPal"] as const;
  const paymentMethods = PAYMENT_METHODS.map((type) => ({ id: type, name: strings[type] }));

  // Brand-green palette for person discs (cycled by slot position) — same as the
  // listing cards, so a person's colour is consistent across the app.
  const AVATAR_COLORS = ["#529471", "#83cc61", "#385455", "#6bae7e", "#4a7d63"];
  const colorFor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];
  const nameFor = (index: number) =>
    chequeData.cheque_people[index]?.name || strings["anonymous"];

  // The auth user that a person slot belongs to (creator's slot id === userId;
  // others link via linked_user_id).
  const ownerUserId = (index: number) => {
    const c = chequeData.cheque_people[index];
    return c?.linked_user_id ?? c?.id ?? "";
  };

  // Group the pure settlement transfers by payee (one card per creditor), keeping
  // the structured payer/amount so the UI can render avatars + the amount apart.
  const lines = $derived.by(() => {
    const grouped = new Map<number, { payerIndex: number; amount: number }[]>();
    for (const t of settlement.transfers) {
      const list = grouped.get(t.toIndex) ?? [];
      list.push({ payerIndex: t.fromIndex, amount: t.amount });
      grouped.set(t.toIndex, list);
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
    chequeData.cheque_people.some((c) => c.id === userId || c.linked_user_id === userId),
  );

  // Count how many people receive money (distinct payees), not the number of
  // transfers; `lines` is already grouped by payee. Singular vs plural.
  const recipientsLabel = $derived(
    interpolateString(
      lines.size === 1 ? strings["{count}Recipient"] : strings["{count}Recipients"],
      { count: String(lines.size) },
    ),
  );
</script>

{#snippet switchIcon()}<ReplaceUser />{/snippet}
{#snippet unlinkIcon()}<Unlink />{/snippet}

{#if settlement.transfers.length > 0 || unaccounted}
  <section class="settle" class:embedded>
    <div class="settle-inner">
      {#if !embedded}
        <header class="settle-head">
          <h2 class="settle-title">{strings["settleUp"]}</h2>
          {#if settlement.transfers.length > 0}
            <span class="count">{recipientsLabel}</span>
          {/if}
        </header>
      {/if}

      <div class="cards">
      {#each lines as [personIndex, transfers] (personIndex)}
        {@const linkedUserId = ownerUserId(personIndex)}
        {@const chequeUser = chequeData.cheque_users.find((bu) => bu.user_id === linkedUserId)}
        {@const isMine = linkedUserId === userId}
        {@const payee = nameFor(personIndex)}
        <article class="card">
          {#each transfers as t}
            <div class="transfer">
              <Avatar name={nameFor(t.payerIndex)} color={colorFor(t.payerIndex)} size="1.75rem" />
              <svg
                class="arrow"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              <Avatar name={payee} color={colorFor(personIndex)} size="1.75rem" />
              <span class="who">
                {interpolateString(strings["{payer}Pays{payee}"], {
                  payee,
                  payer: nameFor(t.payerIndex),
                })}
              </span>
              <span class="amount">{getNumericDisplay(currencyFormatter, t.amount)}</span>
            </div>
          {/each}

          {#if chequeUser?.payment_id && chequeUser.payment_method && !isMine}
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
            <div class="account">
              <Button
                borderless
                onclick={async () => {
                  const personId = chequeData.cheque_people[personIndex].id;
                  await updatePerson(app, chequeData.id, {
                    id: personId,
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
            <div class="account details editable">
              <EntrySelect
                autocomplete="off"
                name={`payment-method-${userId}`}
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
                autocomplete="email"
                inputmode="email"
                name={`payment-id-${userId}`}
                onchange={async (e) => {
                  const value = e.currentTarget.value;
                  await updateChequeUser(app, chequeData.id, { payment_id: value, userId });
                  await updateUser(app, { default_payment_id: value });
                }}
                placeholder={strings["paymentId"]}
                title={strings["paymentId"]}
                value={chequeUser?.payment_id}
              />
              <!-- Only for a slot you explicitly linked to (not your own identity
                   slot, which can't be unlinked): switch which person is you, or
                   undo the link entirely. Icon-only to stay compact. -->
              {#if chequeData.cheque_people[personIndex].linked_user_id === userId}
                <span class="link-actions">
                  <Button
                    borderless
                    color="warning"
                    icon={switchIcon}
                    onclick={() =>
                      goto(`${page.url.pathname}${page.url.search}#claim`, { noScroll: true })}
                    padding={0.5}
                    title={strings["changeWhichPersonIsYou"]}
                  />
                  <Button
                    borderless
                    color="error"
                    icon={unlinkIcon}
                    onclick={async () => {
                      await updatePerson(app, chequeData.id, {
                        id: chequeData.cheque_people[personIndex].id,
                        linked_user_id: null,
                      });
                    }}
                    padding={0.5}
                    title={interpolateString(strings["unlinkYourAccountFrom{payee}"], { payee })}
                  />
                </span>
              {/if}
            </div>
          {:else}
            <div class="account inactive">
              {interpolateString(strings["{user}HasNoPaymentAccountSetUp"], { user: payee })}
            </div>
          {/if}
        </article>
      {/each}

        {#if unaccounted}
          <article class="card unaccounted">{unaccounted}</article>
        {/if}
      </div>
    </div>
  </section>
{/if}

<style>
  .settle {
    display: flex;
    justify-content: center;
    padding: var(--space-4) var(--space-2) var(--space-5);
  }
  /* Inline (desktop): occupy the viewport width and stick to its left so the
     section stays centered in view while the wide grid scrolls horizontally —
     same trick as the grid's action bar (100cqw falls back to the viewport). */
  .settle:not(.embedded) {
    inline-size: 100cqw;
    left: 0;
    max-inline-size: 100cqw;
    position: sticky;
    right: 0;
  }
  /* In the mobile settle sheet the Dialog frames it — no outer chrome. */
  .settle.embedded {
    padding: var(--space-3);
  }
  .settle-inner {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    inline-size: 100%;
    max-inline-size: 38rem;
  }

  .settle-head {
    align-items: baseline;
    display: flex;
    gap: var(--space-3);
    justify-content: space-between;
  }
  .settle-title {
    font-size: var(--text-lg);
    font-weight: 700;
    margin: 0;
  }
  /* Right-aligned, greyed — a label sitting above the payment amounts (matches
     the totals' Paid/Owing/Balance labels), not a filled chip. */
  .count {
    color: var(--color-text-muted);
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-sm);
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .card {
    background: var(--color-background-raised);
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    /* No bottom padding: the account line (min 40px, centred) hugs the bottom. */
    padding: var(--space-3) var(--space-4) 0;
  }
  .card.unaccounted {
    color: var(--color-text-muted);
    font-family: "JetBrains Mono", monospace;
    /* No account line here, so keep its own bottom padding. */
    padding-block-end: var(--space-3);
  }

  /* payer → arrow → payee · "X pays Y" · amount */
  .transfer {
    align-items: center;
    display: flex;
    gap: var(--space-2);
  }
  .arrow {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
  .who {
    font-weight: 600;
    margin-inline-start: var(--space-1);
    min-inline-size: 0;
  }
  /* Same size + colour as the rest of the row; emphasised only by weight. */
  .amount {
    color: var(--color-text);
    font-family: "JetBrains Mono", monospace;
    font-weight: 700;
    margin-inline-start: auto;
    padding-inline-start: var(--space-2);
  }

  /* payee's payment account: handle + copy / link / editable / none */
  /* Fixed min-height + centered content so the line doesn't resize as it swaps
     between the inputs / button / text variants (no padding-top needed). */
  .account {
    align-items: center;
    border-block-start: var(--border-divider) dashed var(--color-border);
    color: var(--color-text-muted);
    display: flex;
    flex-wrap: wrap;
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-sm);
    gap: var(--space-1) var(--space-2);
    min-block-size: 40px;
  }
  .account.editable {
    color: var(--color-action);
  }
  .account.inactive {
    color: var(--color-text-inactive);
  }
  .separator {
    color: var(--color-text-muted);
  }
  /* Switch + unlink sit at the right end of the editable payment line. */
  .link-actions {
    display: inline-flex;
    gap: var(--space-1);
    margin-inline-start: auto;
  }
</style>
