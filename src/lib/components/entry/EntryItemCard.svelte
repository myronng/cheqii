<!--
  One line-item as a card (the mobile editor). Name + cost, a "Payer" dropdown
  (kept as a select per the design), and the split as avatar toggle chips — tap to
  include/exclude (ratio 1/0). Tapping the "Split evenly / Custom split" label
  (with a chevron) expands per-person ratio steppers so weighted splits stay fully
  editable, matching the desktop grid. The card uses the monospace font by default
  (so the content-fit inputs measure correctly).
-->
<script lang="ts">
  import Avatar from "$lib/components/base/Avatar.svelte";
  import EntryInput from "$lib/components/entry/EntryInput.svelte";
  import EntrySelect from "$lib/components/entry/EntrySelect.svelte";
  import ChevronDown from "$lib/components/icons/ChevronDown.svelte";
  import Delete from "$lib/components/icons/Delete.svelte";
  import { deleteItem, updateItem, updateSplitRatio } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";
  import type { ChequeData, ItemRow } from "$lib/state/model";
  import {
    AMOUNT_MAX,
    AMOUNT_MIN,
    getNumericDisplay,
    INTEGER_FORMATTER,
    SPLIT_MAX,
    SPLIT_MIN,
  } from "$lib/utils/common/formatter";
  import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";
  import { avatarColor } from "$lib/utils/common/palette";

  let {
    canDelete,
    chequeData,
    currencyFactor,
    currencyFormatter,
    item,
    strings,
  }: {
    canDelete: boolean;
    chequeData: ChequeData;
    currencyFactor: number;
    currencyFormatter: Intl.NumberFormat;
    item: ItemRow;
    strings: LocalizedStrings;
  } = $props();

  const app = getAppContext();
  let expanded = $state(false);

  const people = $derived(chequeData.cheque_people);
  const splitFor = (personId: string) =>
    chequeData.cheque_item_splits.find((s) => s.item_id === item.id && s.person_id === personId);

  // Even split = every included person (ratio > 0) carries the same weight.
  const evenly = $derived.by(() => {
    const ratios = people.map((p) => splitFor(p.id)?.ratio ?? 0).filter((r) => r > 0);
    return ratios.length > 0 && ratios.every((r) => r === ratios[0]);
  });

  async function toggleInclude(personId: string) {
    const split = splitFor(personId);
    if (!split) return;
    await updateSplitRatio(app, chequeData.id, {
      id: split.id,
      ratio: (split.ratio ?? 0) > 0 ? 0 : 1,
    });
  }
</script>

<article class="card" data-item={item.id}>
  <div class="top">
    <span class="name">
      <EntryInput
        autocomplete="off"
        fit
        name={`item-name-${item.id}`}
        onchange={async (e) => {
          await updateItem(app, chequeData.id, { id: item.id, name: e.currentTarget.value });
        }}
        title={interpolateString(strings["item{index}"], { index: String((item.sort ?? 0) + 1) })}
        value={item.name}
      />
    </span>
    <div class="right">
      <span class="cost">
        <EntryInput
          autocomplete="off"
          fit
          formatter={currencyFormatter}
          inputmode="decimal"
          max={AMOUNT_MAX}
          min={AMOUNT_MIN}
          name={`item-cost-${item.id}`}
          onchange={async (e) => {
            await updateItem(app, chequeData.id, {
              cost: Number(e.currentTarget.value) * currencyFactor,
              id: item.id,
            });
          }}
          title={interpolateString(strings["{item}Cost"], { item: item.name })}
          value={getNumericDisplay(currencyFormatter, item.cost)}
        />
      </span>
      {#if canDelete}
        <button
          class="delete"
          onclick={async () => await deleteItem(app, chequeData.id, item.id)}
          title={interpolateString(strings["remove{item}"], { item: item.name })}
          type="button"
        >
          <Delete />
        </button>
      {/if}
    </div>
  </div>

  <div class="payer">
    <span class="label">{strings["buyer"]}</span>
    <EntrySelect
      autocomplete="off"
      chevron
      name={`item-buyer-${item.id}`}
      onchange={async (e) => {
        await updateItem(app, chequeData.id, { id: item.id, person_id: e.currentTarget.value });
      }}
      options={people}
      title={interpolateString(strings["{item}Buyer"], { item: item.name })}
      value={item.person_id ?? undefined}
    />
    <button class="split-toggle" onclick={() => (expanded = !expanded)} type="button">
      {evenly ? strings["splitEvenly"] : strings["customSplit"]}
      <span class="chevron" class:open={expanded}><ChevronDown /></span>
    </button>
  </div>

  {#if expanded}
    <div class="weights">
      {#each people as person, i}
        {@const split = splitFor(person.id)}
        <div class="weight-row">
          <Avatar name={person.name ?? ""} color={avatarColor(i)} size="1.5rem" />
          <span class="weight-name">{person.name || strings["anonymous"]}</span>
          <EntryInput
            autocomplete="off"
            formatter={INTEGER_FORMATTER}
            inputmode="numeric"
            max={SPLIT_MAX}
            min={SPLIT_MIN}
            name={`split-${item.id}-${person.id}`}
            onchange={async (e) => {
              if (split) {
                await updateSplitRatio(app, chequeData.id, {
                  id: split.id,
                  ratio: Number(e.currentTarget.value),
                });
              }
            }}
            title={interpolateString(strings["{item}ContributionFrom{person}"], {
              item: item.name,
              person: person.name || strings["anonymous"],
            })}
            value={getNumericDisplay(INTEGER_FORMATTER, split?.ratio ?? 0)}
          />
        </div>
      {/each}
    </div>
  {:else}
    <div class="shares">
      {#each people as person, i}
        {@const ratio = splitFor(person.id)?.ratio ?? 0}
        <button
          class="chip"
          class:off={ratio === 0}
          onclick={() => toggleInclude(person.id)}
          title={person.name || strings["anonymous"]}
          type="button"
        >
          <Avatar name={person.name ?? ""} color={avatarColor(i)} size="1.375rem" />
          {#if ratio > 0}<span class="weight">×{ratio}</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</article>

<style>
  /* Monospace by default for the whole card — the content-fit inputs measure
     their width in `ch`, which only matches a monospace font. Individual fields
     no longer set their own font. */
  .card {
    background: var(--color-background-raised);
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    display: flex;
    flex-direction: column;
    font-family: "JetBrains Mono", monospace;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  /* Name (left) + cost & delete (right). The cost never shrinks — the name
     truncates instead. */
  .top {
    align-items: center;
    display: flex;
    gap: var(--space-2);
    justify-content: space-between;
  }
  .name {
    font-size: var(--text-base);
    font-weight: 600;
    /* Pull left by the input's own padding so the text aligns with the labels
       below (without removing the padding itself). */
    margin-inline-start: calc(var(--space-2) * -1);
    min-inline-size: 0;
  }
  /* Cost + delete; an extra 4px (space-2 vs the prior space-1) keeps the cost off
     the delete button. */
  .right {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: var(--space-2);
  }
  .cost {
    font-weight: 700;
  }
  .delete {
    align-items: center;
    background: transparent;
    block-size: 32px;
    border: 0;
    border-radius: 50%;
    color: var(--color-error);
    cursor: pointer;
    display: inline-flex;
    font-size: 18px;
    inline-size: 32px;
    justify-content: center;

    @media (prefers-reduced-motion: no-preference) {
      transition: background-color var(--dur-fast) var(--ease-standard);
    }
  }
  .delete:active {
    background-color: var(--color-surface-active);
  }

  .payer {
    align-items: center;
    color: var(--color-text-muted);
    display: flex;
    flex-wrap: wrap;
    font-size: var(--text-sm);
    gap: var(--space-1) var(--space-2);
    /* Keep the split toggle off the delete button's column above it. */
    padding-inline-end: var(--space-1);
  }
  /* The split label doubles as the expand toggle (chevron rotates when open). */
  .split-toggle {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--color-action);
    cursor: pointer;
    display: inline-flex;
    font: inherit;
    gap: var(--space-1);
    margin-inline-start: auto;
    padding: 0;
  }
  .chevron {
    align-items: center;
    display: inline-flex;
    font-size: var(--text-sm);

    @media (prefers-reduced-motion: no-preference) {
      transition: transform var(--dur-base) var(--ease-standard);
    }
  }
  .chevron.open {
    transform: rotate(180deg);
  }

  .shares {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .chip {
    align-items: center;
    background: var(--color-surface);
    border: var(--border-divider) solid var(--color-border);
    border-radius: 100vw;
    cursor: pointer;
    display: inline-flex;
    gap: var(--space-1);
    /* Just the avatar by default (circle); only pad the end when a weight shows. */
    padding: 0;

    @media (prefers-reduced-motion: no-preference) {
      transition: opacity var(--dur-fast) var(--ease-standard);
    }
  }
  .chip:has(.weight) {
    padding-inline-end: var(--space-2);
  }
  .chip.off {
    background: transparent;
    opacity: 0.4;
  }
  .chip .weight {
    font-weight: 700;
  }

  .weights {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .weight-row {
    align-items: center;
    display: flex;
    gap: var(--space-2);
  }
  .weight-name {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
