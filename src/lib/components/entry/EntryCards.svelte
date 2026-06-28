<!--
  The mobile cheque editor: a per-person balance strip (taps open the balance
  breakdown), a vertical list of item cards, add buttons, and a sticky footer with
  the grand total + a "Settle up" CTA that opens the settle sheet (#settle). All
  vertical — no horizontal scroll. The desktop grid (EntryGrid) is the wide-screen
  counterpart; both write through the same actions.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Avatar from "$lib/components/base/Avatar.svelte";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import EntryItemCard from "$lib/components/entry/EntryItemCard.svelte";
  import AddCircle from "$lib/components/icons/AddCircle.svelte";
  import AddUser from "$lib/components/icons/AddUser.svelte";
  import type { Allocations } from "$lib/domain/allocate";
  import type { Settlement } from "$lib/domain/settle";
  import { addItem, addPerson } from "$lib/state/actions";
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

  const realItems = $derived(chequeData.cheque_items.filter((i) => !i.is_stub));
  const canDeleteItem = $derived(realItems.length > 1);

  const balanceFor = (index: number) => {
    const c = allocations.contributions.get(index);
    return (c?.paid.total ?? 0) - (c?.owing.total ?? 0);
  };

  const hasSettlement = $derived(
    settlement.transfers.length > 0 ||
      settlement.owingUnaccounted + settlement.paidUnaccounted > 0,
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
  }
</script>

<div class="cards">
  <!-- per-person balances (wrap, no horizontal scroll) -->
  <div class="people">
    {#each chequeData.cheque_people as person, i}
      {#if !person.is_stub}
        {@const balance = balanceFor(i)}
        <button class="person" onclick={() => open(`c-${person.id}`)} type="button">
          <Avatar name={person.name ?? ""} color={avatarColor(i)} size="1.875rem" />
          <span class="person-text">
            <span class="person-name">{person.name || strings["anonymous"]}</span>
            <span class="person-balance" class:negative={balance < 0}>
              {balance < 0 ? "−" : "+"}{getNumericDisplay(currencyFormatter, Math.abs(balance))}
            </span>
          </span>
        </button>
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

    <div class="add">
      <Button icon={addItemIcon} onclick={onAddItem}>{strings["addItem"]}</Button>
      <Button icon={addPersonIcon} onclick={onAddPerson}>{strings["addPerson"]}</Button>
    </div>
  </div>

  <!-- sticky footer: grand total + settle CTA -->
  <div class="footer">
    <div class="total">
      <span class="total-label">{strings["total"]}</span>
      <span class="total-value">{getNumericDisplay(currencyFormatter, allocations.grandTotal)}</span>
    </div>
    {#if hasSettlement}
      <Button variant="primary" onclick={() => open("settle")}>
        {#if settlement.transfers.length > 0}
          {strings["settleUp"]} · {interpolateString(strings["{count}Payments"], {
            count: String(settlement.transfers.length),
          })}
        {:else}
          {strings["settleUp"]}
        {/if}
      </Button>
    {/if}
  </div>
</div>

{#snippet addItemIcon()}
  <AddCircle />
{/snippet}
{#snippet addPersonIcon()}
  <AddUser />
{/snippet}

<style>
  .cards {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-block-size: 0;
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
    cursor: pointer;
    display: flex;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3) var(--space-1) var(--space-1);
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
