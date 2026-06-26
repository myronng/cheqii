<script lang="ts">
  import Button from "$lib/components/base/buttons/Button.svelte";
  import EntryInput from "$lib/components/entry/EntryInput.svelte";
  import EntrySelect from "$lib/components/entry/EntrySelect.svelte";
  import AddCircle from "$lib/components/icons/AddCircle.svelte";
  import AddUser from "$lib/components/icons/AddUser.svelte";
  import MinusCircle from "$lib/components/icons/MinusCircle.svelte";
  import MinusUser from "$lib/components/icons/MinusUser.svelte";
  import type { Allocations } from "$lib/domain/allocate";
  import {
    addContributor,
    addItem,
    deleteContributor,
    deleteItem,
    updateContributor,
    updateItem,
    updateSplitRatio,
  } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";
  import type { BillData } from "$lib/state/model";
  import {
    CURRENCY_MAX,
    CURRENCY_MIN,
    getNumericDisplay,
    INTEGER_FORMATTER,
    SPLIT_MAX,
    SPLIT_MIN,
  } from "$lib/utils/common/formatter";
  import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";

  let {
    allocations,
    billData,
    contributorSummaryIndex = $bindable(),
    currencyFactor,
    currencyFormatter,
    strings,
    userId,
  }: {
    allocations: Allocations;
    billData: BillData;
    contributorSummaryIndex: number;
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
      {#each billData.bill_contributors as contributor, contributorIndex}
        <EntryInput
          alignment="end"
          onchange={async (e) => {
            await updateContributor(app, billData.id, {
              id: contributor.id,
              name: e.currentTarget.value,
            });
          }}
          onfocus={() => {
            selectedCoordinates = { x: 3 + contributorIndex, y: 0 };
          }}
          title={interpolateString(strings["contributor{index}"], {
            index: (contributorIndex + 1).toString(),
          })}
          value={contributor.name}
        />
      {/each}
      {#each billData.bill_items as item, itemIndex}
        {@const isAlternate = itemIndex % 2 === 0}
        {@const selectedItemIndex = itemIndex + 1}
        <EntryInput
          {isAlternate}
          onchange={async (e) => {
            await updateItem(app, billData.id, {
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
          max={CURRENCY_MAX}
          min={CURRENCY_MIN}
          onchange={async (e) => {
            await updateItem(app, billData.id, {
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
            await updateItem(app, billData.id, {
              contributor_id: e.currentTarget.value,
              id: item.id,
            });
          }}
          onfocus={() => {
            selectedCoordinates = { x: 2, y: selectedItemIndex };
          }}
          options={billData.bill_contributors}
          title={interpolateString(strings["{item}Buyer"], { item: item.name })}
          value={item.contributor_id}
        />
        {#each billData.bill_contributors as contributor, splitIndex}
          {@const split = billData.bill_item_splits.find(
            (s) => s.item_id === item.id && s.contributor_id === contributor.id,
          )}
          <EntryInput
            formatter={INTEGER_FORMATTER}
            inputmode="numeric"
            {isAlternate}
            max={SPLIT_MAX}
            min={SPLIT_MIN}
            onchange={async (e) => {
              if (split) {
                await updateSplitRatio(app, billData.id, {
                  id: split.id,
                  ratio: Number(e.currentTarget.value),
                });
              }
            }}
            onfocus={() => {
              selectedCoordinates = { x: 3 + splitIndex, y: selectedItemIndex };
            }}
            title={interpolateString(strings["{item}ContributionFrom{contributor}"], {
              contributor: contributor.name || strings["anonymous"],
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
            // Default buyer: the current user if they're a contributor, else the first.
            const contributorId = billData.bill_contributors.reduce((acc, curr, index) => {
              if (index === 0) acc = curr.id;
              else if (curr.id === userId) acc = curr.id;
              return acc;
            }, userId);
            const splits = billData.bill_contributors.map((contributor) => ({
              contributor_id: contributor.id,
              id: crypto.randomUUID(),
              item_id: itemId,
              ratio: 0,
            }));
            await addItem(app, billData.id, {
              item: {
                contributor_id: contributorId,
                cost: 0,
                id: itemId,
                name: interpolateString(strings["item{index}"], {
                  index: String(billData.bill_items.length + 1),
                }),
                sort: billData.bill_items.length,
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
            const contributorId = crypto.randomUUID();
            const splits = billData.bill_items.map((item) => ({
              contributor_id: contributorId,
              id: crypto.randomUUID(),
              item_id: item.id,
              ratio: 0,
            }));
            await addContributor(app, billData.id, {
              contributor: {
                id: contributorId,
                name: interpolateString(strings["contributor{index}"], {
                  index: String(billData.bill_contributors.length + 1),
                }),
                sort: billData.bill_contributors.length,
              },
              splits,
            });
          }}
        >
          <AddUser />
          <span class="hideMobile">{strings["addContributor"]}</span>
        </Button>
        {#if selectedCoordinates !== null}
          {#if selectedCoordinates.y > 0 && billData.bill_items.length > 1}
            <Button
              color="error"
              onclick={async () => {
                if (selectedCoordinates) {
                  const deletedItem = billData.bill_items[selectedCoordinates.y - 1];
                  selectedCoordinates = null;
                  await deleteItem(app, billData.id, deletedItem.id);
                }
              }}
            >
              <MinusCircle />
              <span class="hideMobile">
                {interpolateString(strings["remove{item}"], {
                  item: billData.bill_items[selectedCoordinates.y - 1].name,
                })}
              </span>
            </Button>
          {/if}
          {#if selectedCoordinates.x > 2 && billData.bill_contributors.length > 1}
            <Button
              color="error"
              onclick={async () => {
                if (selectedCoordinates) {
                  const selectedContributor =
                    billData.bill_contributors[selectedCoordinates.x - 3];
                  const reassignToId =
                    billData.bill_contributors.find((c) => c.id === userId)?.id ??
                    billData.bill_contributors[0]?.id ??
                    userId;
                  selectedCoordinates = null;
                  await deleteContributor(app, billData.id, {
                    contributorId: selectedContributor.id,
                    reassignToId,
                  });
                }
              }}
            >
              <MinusUser />
              <span class="hideMobile">
                {interpolateString(strings["remove{item}"], {
                  item: billData.bill_contributors[selectedCoordinates.x - 3].name,
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
            onclick={() => {
              (document.getElementById("summaryDialog") as HTMLDialogElement).showModal();
              contributorSummaryIndex = index;
            }}
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
    background-color: var(--color-background-primary);
    border-top: var(--length-divider) solid var(--color-divider);
    bottom: 0;
    padding: var(--length-spacing) 0;
    position: sticky;
    top: 0;
    grid-column: 1 / -1;
    z-index: 100;

    .scroller {
      display: flex;
      font: 1rem Comfortaa;
      gap: calc(var(--length-spacing) * 2);
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
    background-color: var(--color-divider);
    padding-block: calc(var(--length-spacing) * 0.5);
    padding-inline: var(--length-spacing);

    &.numeric {
      text-align: end;
    }
  }

  .totals {
    background-color: var(--color-background-primary);
    border-block-start: var(--length-divider) solid var(--color-divider);
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
    color: var(--color-font-disabled);
  }

  .total {
    block-size: 100%;
    border: 0;
    display: flex;
    flex-direction: column;
    font: inherit;
    gap: var(--length-spacing);
    justify-content: center;
    padding: var(--length-spacing);

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
        background-color: var(--color-background-active);
      }

      &:hover:not(:active) {
        background-color: var(--color-background-hover);
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
