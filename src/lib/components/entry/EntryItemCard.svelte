<!--
  One line-item as a card (the mobile editor). Name + cost (each sized to its
  content), a "Paid by" dropdown (kept as a select per the design), and the split
  as avatar toggle chips — tap to include/exclude (ratio 1/0). Tapping the
  "Split evenly / Custom split" label (with a chevron) expands per-person ratio
  steppers so weighted splits stay fully editable, matching the desktop grid.
  Delete lives in a separate trailing column so it isn't a misclick target next to
  the cost / split controls.
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
  <div class="content">
    <div class="top">
      <span class="name">
        <EntryInput
          fit
          onchange={async (e) => {
            await updateItem(app, chequeData.id, { id: item.id, name: e.currentTarget.value });
          }}
          title={interpolateString(strings["item{index}"], { index: String((item.sort ?? 0) + 1) })}
          value={item.name}
        />
      </span>
      <span class="cost">
        <EntryInput
          fit
          formatter={currencyFormatter}
          inputmode="decimal"
          max={AMOUNT_MAX}
          min={AMOUNT_MIN}
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
    </div>

    <div class="payer">
      <span class="label">{strings["paidBy"]}</span>
      <EntrySelect
        chevron
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
              formatter={INTEGER_FORMATTER}
              inputmode="numeric"
              max={SPLIT_MAX}
              min={SPLIT_MIN}
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
            {#if ratio > 1}<span class="weight">×{ratio}</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if canDelete}
    <!-- Own trailing column (divider-separated) so it's clear of the cost/split. -->
    <div class="trailing">
      <button
        class="delete"
        onclick={async () => await deleteItem(app, chequeData.id, item.id)}
        title={interpolateString(strings["remove{item}"], { item: item.name })}
        type="button"
      >
        <Delete />
      </button>
    </div>
  {/if}
</article>

<style>
  .card {
    background: var(--color-background-raised);
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    display: flex;
  }
  .content {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--space-3);
    min-inline-size: 0;
    padding: var(--space-4);
  }
  /* Delete in its own divider-separated, vertically-centered column. */
  .trailing {
    align-items: center;
    border-inline-start: var(--border-divider) solid var(--color-border);
    display: flex;
    justify-content: center;
    padding-inline: var(--space-2);
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

  /* Name (left) + cost (right), each sized to content; the gap between them grows
     to fill the row. The cost never shrinks — the name truncates instead. */
  .top {
    align-items: center;
    display: flex;
    gap: var(--space-2);
    justify-content: space-between;
  }
  /* Monospace so the `fit` width (value.length × ch) matches the rendered text —
     a proportional font makes ch under/overshoot. */
  .name {
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-base);
    font-weight: 600;
    min-inline-size: 0;
  }
  .cost {
    flex-shrink: 0;
    font-family: "JetBrains Mono", monospace;
    font-weight: 700;
  }

  .payer {
    align-items: center;
    color: var(--color-text-muted);
    display: flex;
    flex-wrap: wrap;
    font-size: var(--text-sm);
    gap: var(--space-1) var(--space-2);
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
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-sm);
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
