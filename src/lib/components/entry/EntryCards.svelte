<!--
  The mobile cheque editor: a per-person balance strip (taps open the balance
  breakdown), a vertical list of item cards, add buttons, and a sticky footer with
  the grand total + a "Settle up" CTA that opens the settle sheet (#settle). All
  vertical — no horizontal scroll. The desktop grid (EntryGrid) is the wide-screen
  counterpart; both write through the same actions.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Avatar from "$lib/components/base/Avatar.svelte";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import EntryItemCard from "$lib/components/entry/EntryItemCard.svelte";
  import AddCircle from "$lib/components/icons/AddCircle.svelte";
  import AddUser from "$lib/components/icons/AddUser.svelte";
  import Cancel from "$lib/components/icons/Cancel.svelte";
  import Link from "$lib/components/icons/Link.svelte";
  import type { Allocations } from "$lib/domain/allocate";
  import type { Settlement } from "$lib/domain/settle";
  import { addItem, addPerson, deletePerson } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";
  import type { ChequeData } from "$lib/state/model";
  import { getNumericDisplay } from "$lib/utils/common/formatter";
  import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";
  import { avatarColor } from "$lib/utils/common/palette";

  let {
    allocations,
    chequeData,
    currencyFactor,
    currencyFormatter,
    settlement,
    strings,
    userId,
  }: {
    allocations: Allocations;
    chequeData: ChequeData;
    currencyFactor: number;
    currencyFormatter: Intl.NumberFormat;
    settlement: Settlement;
    strings: LocalizedStrings;
    userId: string;
  } = $props();

  const app = getAppContext();

  // Which chip is the signed-in user (own slot or linked), to mark "you". -1 = none.
  const myIndex = $derived(
    chequeData.cheque_people.findIndex((c) => c.id === userId || c.linked_user_id === userId),
  );

  const realItems = $derived(chequeData.cheque_items.filter((i) => !i.is_stub));
  const canDeleteItem = $derived(realItems.length > 1);
  const canDeletePerson = $derived(
    chequeData.cheque_people.filter((p) => !p.is_stub).length > 1,
  );

  // Mirror the grid's person delete: reassign the removed person's items to the
  // caller (preferred) or any other person, then delete. Never reassign to self.
  async function onDeletePerson(personId: string) {
    const reassignToId =
      chequeData.cheque_people.find((p) => p.id === userId && p.id !== personId)?.id ??
      chequeData.cheque_people.find((p) => !p.is_stub && p.id !== personId)?.id ??
      userId;
    await deletePerson(app, chequeData.id, { personId, reassignToId });
  }

  const balanceFor = (index: number) => {
    const c = allocations.contributions.get(index);
    return (c?.paid.total ?? 0) - (c?.owing.total ?? 0);
  };

  const hasSettlement = $derived(
    settlement.transfers.length > 0 ||
      settlement.owingUnaccounted + settlement.paidUnaccounted > 0,
  );
  // How many people receive money (distinct payees), not the number of transfers.
  const recipientCount = $derived(new Set(settlement.transfers.map((t) => t.toIndex)).size);
  const recipientsLabel = $derived(
    interpolateString(
      recipientCount === 1 ? strings["{count}Recipient"] : strings["{count}Recipients"],
      { count: String(recipientCount) },
    ),
  );
  const open = (hash: string) =>
    goto(`${page.url.pathname}${page.url.search}#${hash}`, { noScroll: true });

  async function onAddItem() {
    const itemId = crypto.randomUUID();
    // Default buyer: the current user if they're a person, else the first slot.
    const personId = chequeData.cheque_people.reduce((acc, curr, index) => {
      if (index === 0) acc = curr.id;
      else if (curr.id === userId) acc = curr.id;
      return acc;
    }, userId);
    const splits = chequeData.cheque_people.map((person) => ({
      id: crypto.randomUUID(),
      item_id: itemId,
      person_id: person.id,
      ratio: 0,
    }));
    await addItem(app, chequeData.id, {
      item: {
        cost: 0,
        id: itemId,
        name: interpolateString(strings["item{index}"], {
          index: String(chequeData.cheque_items.length + 1),
        }),
        person_id: personId,
        sort: chequeData.cheque_items.length,
      },
      splits,
    });
    // Focus the new card's name input so you can type the description right away.
    await tick();
    document.querySelector<HTMLInputElement>(`[data-item="${itemId}"] input`)?.focus();
  }

  async function onAddPerson() {
    const personId = crypto.randomUUID();
    const splits = chequeData.cheque_items.map((item) => ({
      id: crypto.randomUUID(),
      item_id: item.id,
      person_id: personId,
      ratio: 0,
    }));
    await addPerson(app, chequeData.id, {
      person: {
        id: personId,
        name: interpolateString(strings["person{index}"], {
          index: String(chequeData.cheque_people.length + 1),
        }),
        sort: chequeData.cheque_people.length,
      },
      splits,
    });
    // Open the new person's breakdown and focus its name field so you can rename
    // it immediately (focus is only triggered from here, not when tapping a chip).
    await open(`c-${personId}`);
    await tick();
    document.querySelector<HTMLInputElement>("dialog[open] .summary-name input")?.focus();
  }
</script>

<div class="cards">
  <!-- per-person balances (wrap, no horizontal scroll) -->
  <div class="people">
    {#each chequeData.cheque_people as person, i}
      {#if !person.is_stub}
        {@const balance = balanceFor(i)}
        <div class="person" class:mine={i === myIndex}>
          <button class="person-main" onclick={() => open(`c-${person.id}`)} type="button">
            <span class="avatar-wrap">
              <Avatar name={person.name ?? ""} color={avatarColor(i)} size="1.875rem" />
              {#if i === myIndex}
                <span class="mine-badge" title={strings["linkedToYou"]}><Link /></span>
              {/if}
            </span>
            <span class="person-text">
              <span class="person-name">{person.name || strings["anonymous"]}</span>
              <span class="person-balance" class:negative={balance < 0}>
                {balance < 0 ? "−" : "+"}{getNumericDisplay(currencyFormatter, Math.abs(balance))}
              </span>
            </span>
          </button>
          {#if canDeletePerson}
            <button
              class="person-del"
              onclick={() => onDeletePerson(person.id)}
              title={interpolateString(strings["remove{item}"], {
                item: person.name || strings["anonymous"],
              })}
              type="button"
            >
              <Cancel />
            </button>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  <!-- item cards -->
  <div class="items">
    {#each realItems as item (item.id)}
      <EntryItemCard
        canDelete={canDeleteItem}
        {chequeData}
        {currencyFactor}
        {currencyFormatter}
        {item}
        {strings}
      />
    {/each}

    <!-- Icon passed as a child (not the `icon` prop) so the button keeps its normal
         pill sizing on mobile instead of Button's icon-only 32px treatment. -->
    <div class="add">
      <Button onclick={onAddItem}><AddCircle />{strings["addItem"]}</Button>
      <!-- Add person creates the person, opens their breakdown, and focuses the
           name field (see onAddPerson). -->
      <Button onclick={onAddPerson}><AddUser />{strings["addPerson"]}</Button>
    </div>
  </div>

  <!-- sticky footer: grand total + settle CTA -->
  <div class="footer">
    <div class="total">
      <span class="total-label">{strings["total"]}</span>
      <span class="total-value">{getNumericDisplay(currencyFormatter, allocations.grandTotal)}</span>
    </div>
    {#if hasSettlement}
      <Button block variant="primary" onclick={() => open("settle")}>
        {#if settlement.transfers.length > 0}
          {strings["settleUp"]} · {recipientsLabel}
        {:else}
          {strings["settleUp"]}
        {/if}
      </Button>
    {/if}
  </div>
</div>

<style>
  /* At least the scroll viewport's height (so the footer can sit at the bottom
     when the list is short) but grows with the list so `main` scrolls it. */
  .cards {
    display: flex;
    flex-direction: column;
    min-block-size: 100%;
  }

  .people {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-3) var(--space-1);
  }
  .person {
    align-items: center;
    background: var(--color-background-raised);
    border: var(--border-divider) solid var(--color-border);
    border-radius: 100vw;
    display: flex;
  }
  /* The signed-in user's own chip: dashed action border + a link badge, mirroring
     the desktop totals treatment. */
  .person.mine {
    border-color: var(--color-action);
    border-style: dashed;
  }
  .avatar-wrap {
    display: inline-flex;
    position: relative;
  }
  .mine-badge {
    align-items: center;
    background-color: var(--color-background-raised);
    border-radius: 50%;
    color: var(--color-action);
    display: flex;
    font-size: 0.75rem;
    inset-block-end: -2px;
    inset-inline-end: -2px;
    padding: 1px;
    pointer-events: none;
    position: absolute;
  }
  .person-main {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 100vw;
    cursor: pointer;
    display: flex;
    font: inherit;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-1);
  }
  /* Stays the default (muted) colour the whole time — no red on hover/active. */
  .person-del {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 50%;
    color: var(--color-text-muted);
    cursor: pointer;
    display: inline-flex;
    /* Smaller than the header icons — this is a compact inline affordance. */
    font-size: var(--text-sm);
    margin-inline-end: var(--space-1);
    padding: calc(var(--space-1) * 0.5);
  }
  .person-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    text-align: start;
  }
  .person-name {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .person-balance {
    color: var(--color-action);
    font-family: "JetBrains Mono", monospace;
    font-weight: 700;
  }
  .person-balance.negative {
    color: var(--color-error);
  }

  .items {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3) var(--space-4);
  }
  .add {
    display: flex;
    gap: var(--space-3);
    justify-content: center;
    padding-block-start: var(--space-2);
  }

  .footer {
    background-color: var(--color-background);
    border-block-start: var(--border-divider) solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    inset-block-end: 0;
    margin-block-start: auto;
    padding: var(--space-3) var(--space-3) var(--space-4);
    position: sticky;
  }
  .total {
    align-items: baseline;
    display: flex;
    justify-content: space-between;
  }
  .total-label {
    font-weight: 700;
  }
  .total-value {
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-xl);
    font-weight: 700;
  }
</style>
