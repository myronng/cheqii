<!--
  One line-item as a card (the mobile editor). Name + cost, a "Paid by" dropdown
  (kept as a select per the design), and the split as avatar toggle chips — tap to
  include/exclude (ratio 1/0). "Customize" reveals per-person ratio steppers so
  weighted splits stay fully editable, matching the desktop grid's capability.
-->
<script lang="ts">
  import Avatar from "$lib/components/base/Avatar.svelte";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import EntryInput from "$lib/components/entry/EntryInput.svelte";
  import EntrySelect from "$lib/components/entry/EntrySelect.svelte";
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
  let customizing = $state(false);

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

<article class="card">
  <div class="top">
    <span class="name">
      <EntryInput
        onchange={async (e) => {
          await updateItem(app, chequeData.id, { id: item.id, name: e.currentTarget.value });
        }}
        title={interpolateString(strings["item{index}"], { index: String((item.sort ?? 0) + 1) })}
        value={item.name}
      />
    </span>
    <span class="cost">
      <EntryInput
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
    {#if canDelete}
      <Button
        borderless
        color="error"
        icon={deleteIcon}
        onclick={async () => await deleteItem(app, chequeData.id, item.id)}
        padding={0.5}
        title={interpolateString(strings["remove{item}"], { item: item.name })}
      />
    {/if}
  </div>

  <div class="payer">
    <span class="label">{strings["paidBy"]}</span>
    <EntrySelect
      onchange={async (e) => {
        await updateItem(app, chequeData.id, { id: item.id, person_id: e.currentTarget.value });
      }}
      options={people}
      title={interpolateString(strings["{item}Buyer"], { item: item.name })}
      value={item.person_id ?? undefined}
    />
    <span class="split">{evenly ? strings["splitEvenly"] : strings["customSplit"]}</span>
    <Button borderless onclick={() => (customizing = !customizing)} padding={0.5}>
      {strings["customize"]}
    </Button>
  </div>

  {#if customizing}
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
</article>

{#snippet deleteIcon()}
  <Delete variant="button" />
{/snippet}

<style>
  .card {
    background: var(--color-background-raised);
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .top {
    align-items: center;
    display: flex;
    gap: var(--space-2);
  }
  .name {
    flex: 1;
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
  .split {
    margin-inline-start: auto;
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
    padding: var(--space-0) var(--space-2) var(--space-0) var(--space-0);

    @media (prefers-reduced-motion: no-preference) {
      transition: opacity var(--dur-fast) var(--ease-standard);
    }
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
