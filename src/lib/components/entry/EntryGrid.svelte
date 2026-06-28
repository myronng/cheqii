<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import EntryInput from "$lib/components/entry/EntryInput.svelte";
  import EntrySelect from "$lib/components/entry/EntrySelect.svelte";
  import AddCircle from "$lib/components/icons/AddCircle.svelte";
  import AddUser from "$lib/components/icons/AddUser.svelte";
  import MinusCircle from "$lib/components/icons/MinusCircle.svelte";
  import MinusUser from "$lib/components/icons/MinusUser.svelte";
  import type { Allocations } from "$lib/domain/allocate";
  import {
    addPerson,
    addItem,
    deletePerson,
    deleteItem,
    updatePerson,
    updateItem,
    updateSplitRatio,
  } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";
  import type { ChequeData } from "$lib/state/model";
  import {
    AMOUNT_MAX,
    AMOUNT_MIN,
    getNumericDisplay,
    INTEGER_FORMATTER,
    SPLIT_MAX,
    SPLIT_MIN,
  } from "$lib/utils/common/formatter";
  import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";

  let {
    allocations,
    chequeData,
    currencyFactor,
    currencyFormatter,
    strings,
    userId,
  }: {
    allocations: Allocations;
    chequeData: ChequeData;
    currencyFactor: number;
    currencyFormatter: Intl.NumberFormat;
    strings: LocalizedStrings;
    userId: string;
  } = $props();

  const app = getAppContext();
  let selectedCoordinates: { x: number; y: number } | null = $state(null);
</script>

<div class="grid">
  <section
    class="content"
    onfocusout={(e) => {
      const target = e.relatedTarget;
      if (target instanceof HTMLElement) {
        const selectedActions = target.closest(".actions");
        if (!selectedActions) {
          selectedCoordinates = null;
        }
      } else {
        selectedCoordinates = null;
      }
    }}
  >
    <div class="entry">
      <div class="heading text">{strings["item"]}</div>
      <div class="heading numeric text">{strings["cost"]}</div>
      <div class="heading text">{strings["buyer"]}</div>
      {#each chequeData.cheque_people as person, personIndex}
        <EntryInput
          alignment="end"
          onchange={async (e) => {
            await updatePerson(app, chequeData.id, {
              id: person.id,
              name: e.currentTarget.value,
            });
          }}
          onfocus={() => {
            selectedCoordinates = { x: 3 + personIndex, y: 0 };
          }}
          title={interpolateString(strings["person{index}"], {
            index: (personIndex + 1).toString(),
          })}
          value={person.name}
        />
      {/each}
      {#each chequeData.cheque_items as item, itemIndex}
        {@const isAlternate = itemIndex % 2 === 0}
        {@const selectedItemIndex = itemIndex + 1}
        <EntryInput
          {isAlternate}
          onchange={async (e) => {
            await updateItem(app, chequeData.id, {
              id: item.id,
              name: e.currentTarget.value,
            });
          }}
          onfocus={() => {
            selectedCoordinates = { x: 0, y: selectedItemIndex };
          }}
          title={interpolateString(strings["item{index}"], {
            index: selectedItemIndex.toString(),
          })}
          value={item.name}
        />
        <EntryInput
          formatter={currencyFormatter}
          inputmode="decimal"
          {isAlternate}
          max={AMOUNT_MAX}
          min={AMOUNT_MIN}
          onchange={async (e) => {
            await updateItem(app, chequeData.id, {
              cost: Number(e.currentTarget.value) * currencyFactor,
              id: item.id,
            });
          }}
          onfocus={() => {
            selectedCoordinates = { x: 1, y: selectedItemIndex };
          }}
          title={interpolateString(strings["{item}Cost"], { item: item.name })}
          value={getNumericDisplay(currencyFormatter, item.cost)}
        />
        <EntrySelect
          {isAlternate}
          onchange={async (e) => {
            await updateItem(app, chequeData.id, {
              person_id: e.currentTarget.value,
              id: item.id,
            });
          }}
          onfocus={() => {
            selectedCoordinates = { x: 2, y: selectedItemIndex };
          }}
          options={chequeData.cheque_people}
          title={interpolateString(strings["{item}Buyer"], { item: item.name })}
          value={item.person_id}
        />
        {#each chequeData.cheque_people as person, splitIndex}
          {@const split = chequeData.cheque_item_splits.find(
            (s) => s.item_id === item.id && s.person_id === person.id,
          )}
          <EntryInput
            formatter={INTEGER_FORMATTER}
            inputmode="numeric"
            {isAlternate}
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
            onfocus={() => {
              selectedCoordinates = { x: 3 + splitIndex, y: selectedItemIndex };
            }}
            title={interpolateString(strings["{item}ContributionFrom{person}"], {
              person: person.name || strings["anonymous"],
              item: item.name,
            })}
            value={getNumericDisplay(INTEGER_FORMATTER, split?.ratio ?? 0)}
          />
        {/each}
      {/each}
    </div>
    <div class="actions">
      <div class="scroller">
        <Button
          onclick={async () => {
            const itemId = crypto.randomUUID();
            // Default buyer: the current user if they're a person, else the first.
            const personId = chequeData.cheque_people.reduce((acc, curr, index) => {
              if (index === 0) acc = curr.id;
              else if (curr.id === userId) acc = curr.id;
              return acc;
            }, userId);
            const splits = chequeData.cheque_people.map((person) => ({
              person_id: person.id,
              id: crypto.randomUUID(),
              item_id: itemId,
              ratio: 0,
            }));
            await addItem(app, chequeData.id, {
              item: {
                person_id: personId,
                cost: 0,
                id: itemId,
                name: interpolateString(strings["item{index}"], {
                  index: String(chequeData.cheque_items.length + 1),
                }),
                sort: chequeData.cheque_items.length,
              },
              splits,
            });
          }}
        >
          <AddCircle />
          <span class="hideMobile">{strings["addItem"]}</span>
        </Button>
        <Button
          onclick={async () => {
            const personId = crypto.randomUUID();
            const splits = chequeData.cheque_items.map((item) => ({
              person_id: personId,
              id: crypto.randomUUID(),
              item_id: item.id,
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
          }}
        >
          <AddUser />
          <span class="hideMobile">{strings["addPerson"]}</span>
        </Button>
        {#if selectedCoordinates !== null}
          {#if selectedCoordinates.y > 0 && chequeData.cheque_items.length > 1}
            <Button
              color="error"
              onclick={async () => {
                if (selectedCoordinates) {
                  const deletedItem = chequeData.cheque_items[selectedCoordinates.y - 1];
                  selectedCoordinates = null;
                  await deleteItem(app, chequeData.id, deletedItem.id);
                }
              }}
            >
              <MinusCircle />
              <span class="hideMobile">
                {interpolateString(strings["remove{item}"], {
                  item: chequeData.cheque_items[selectedCoordinates.y - 1].name,
                })}
              </span>
            </Button>
          {/if}
          {#if selectedCoordinates.x > 2 && chequeData.cheque_people.length > 1}
            <Button
              color="error"
              onclick={async () => {
                if (selectedCoordinates) {
                  const selectedPerson =
                    chequeData.cheque_people[selectedCoordinates.x - 3];
                  const reassignToId =
                    chequeData.cheque_people.find((c) => c.id === userId)?.id ??
                    chequeData.cheque_people[0]?.id ??
                    userId;
                  selectedCoordinates = null;
                  await deletePerson(app, chequeData.id, {
                    personId: selectedPerson.id,
                    reassignToId,
                  });
                }
              }}
            >
              <MinusUser />
              <span class="hideMobile">
                {interpolateString(strings["remove{item}"], {
                  item: chequeData.cheque_people[selectedCoordinates.x - 3].name,
                })}
              </span>
            </Button>
          {/if}
        {/if}
      </div>
    </div>
    <div class="totals">
      <div class="details">
        <div class="grand text total">
          <div class="label">{strings["total"]}</div>
          <div class="value">
            {getNumericDisplay(currencyFormatter, allocations.grandTotal)}
          </div>
        </div>
        <div class="text total">
          <span>{strings["paid"]}</span>
          <span>{strings["owing"]}</span>
          <span>{strings["balance"]}</span>
        </div>
        {#each allocations.contributions as [index, contribution]}
          {@const balance = contribution.paid.total - contribution.owing.total}
          <button
            class="total numeric"
            onclick={() =>
              goto(`${page.url.pathname}${page.url.search}#c-${chequeData.cheque_people[index].id}`, {
                noScroll: true,
              })}
          >
            <span>{getNumericDisplay(currencyFormatter, contribution.paid.total)}</span>
            <span>{getNumericDisplay(currencyFormatter, contribution.owing.total)}</span>
            <span class={balance < 0 ? "negative" : undefined}>
              {getNumericDisplay(currencyFormatter, balance)}
            </span>
          </button>
        {/each}
      </div>
    </div>
  </section>
</div>

<style>
  @media screen and (max-width: 768px) {
    .hideMobile {
      display: none;
    }
  }

  .actions {
    background-color: var(--color-background);
    border-top: var(--border-divider) solid var(--color-border);
    bottom: 0;
    padding: var(--space-2) 0;
    position: sticky;
    top: 0;
    grid-column: 1 / -1;
    z-index: 100;

    .scroller {
      display: flex;
      font: 1rem Comfortaa;
      gap: calc(var(--space-2) * 2);
      inline-size: 100%;
      justify-content: center;
      left: 0;
      max-inline-size: 100cqw;
      position: sticky;
      right: 0;
    }
  }

  .content {
    display: grid;
    grid-column: full;
    grid-template-columns: subgrid;
    font-family: JetBrains Mono;
    margin-block: 0;
    margin-inline: auto;
    position: relative;
  }

  .entry {
    display: grid;
    grid-column: content;
    grid-template-columns: subgrid;
  }

  .grid {
    display: grid;
    grid-template-columns:
      [full-start] 1fr
      [content-start] var(--content) [content-end]
      1fr [full-end];
    grid-template-rows: max-content;
  }

  .heading {
    background-color: var(--color-border);
    padding-block: calc(var(--space-2) * 0.5);
    padding-inline: var(--space-2);

    &.numeric {
      text-align: end;
    }
  }

  .totals {
    background-color: var(--color-background);
    border-block-start: var(--border-divider) solid var(--color-border);
    display: grid;
    grid-column: full;
    grid-template-columns: subgrid;
    white-space: nowrap;
    z-index: 1000;

    .details {
      display: grid;
      grid-column: content;
      grid-template-columns: subgrid;
    }
  }

  .text {
    color: var(--color-text-muted);
  }

  .total {
    block-size: 100%;
    border: 0;
    display: flex;
    flex-direction: column;
    font: inherit;
    gap: var(--space-2);
    justify-content: center;
    padding: var(--space-2);

    &:not(.text) {
      background-color: transparent;
    }

    &.grand {
      align-items: center;
      grid-column: span 2;
    }

    &.numeric {
      align-items: flex-end;
      color: inherit;
      cursor: pointer;

      @media (prefers-reduced-motion: no-preference) {
        transition: ease background-color 75ms;
      }

      &:active {
        background-color: var(--color-surface-active);
      }

      &:hover:not(:active) {
        background-color: var(--color-surface-hover);
      }
    }

    & .label {
      font-size: 1.25rem;
    }

    & .negative {
      color: var(--color-error);
    }

    & .value {
      font-size: 1.75rem;
    }
  }
</style>
