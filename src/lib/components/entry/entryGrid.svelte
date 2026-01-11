<script lang="ts">
  import type { Allocations } from "$lib/utils/common/allocate";
  import type { BillData, OnBillChange } from "$lib/utils/models/bill.svelte";
  import type { Database } from "$lib/utils/models/database";
  import type { AppUser } from "$lib/utils/models/user.svelte";
  import type { SupabaseClient } from "@supabase/supabase-js";

  import Button from "$lib/components/base/buttons/button.svelte";
  import EntryInput from "$lib/components/entry/entryInput.svelte";
  import EntrySelect from "$lib/components/entry/entrySelect.svelte";
  import AddCircle from "$lib/components/icons/addCircle.svelte";
  import AddUser from "$lib/components/icons/addUser.svelte";
  import MinusCircle from "$lib/components/icons/minusCircle.svelte";
  import MinusUser from "$lib/components/icons/minusUser.svelte";
  import {
    CURRENCY_MAX,
    CURRENCY_MIN,
    getNumericDisplay,
    INTEGER_FORMATTER,
    parseNumericFormat,
    SPLIT_MAX,
    SPLIT_MIN,
  } from "$lib/utils/common/formatter";
  import {
    type LocalizedStrings,
    interpolateString,
  } from "$lib/utils/common/locale";

  let {
    allocations,
    billData = $bindable(),
    contributorSummaryIndex = $bindable(),
    currencyFactor,
    currencyFormatter,
    onBillChange,
    strings,
    supabase,
    userId,
  }: {
    allocations: Allocations;
    billData: BillData;
    contributorSummaryIndex: number;
    currencyFactor: number;
    currencyFormatter: Intl.NumberFormat;
    onBillChange: OnBillChange;
    strings: LocalizedStrings;
    supabase: SupabaseClient<Database>;
    userId: AppUser["id"];
  } = $props();

  const contributorMap = new Map<
    BillData["bill_contributors"][number]["id"],
    BillData["bill_contributors"][number]
  >();
  for (const contributor of billData.bill_contributors) {
    contributorMap.set(contributor.id, contributor);
  }
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
            contributor.name = e.currentTarget.value;
            await Promise.all([
              supabase.from("bill_contributors").upsert({
                bill_id: billData.id,
                id: contributor.id,
                name: contributor.name,
                sort: contributorIndex,
              }),
              onBillChange(billData),
            ]);
            // TODO: Handle errors
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
            item.name = e.currentTarget.value;
            await Promise.all([
              supabase.from("bill_items").upsert({
                bill_id: billData.id,
                contributor_id: item.contributor_id,
                cost: item.cost,
                id: item.id,
                name: item.name,
                sort: itemIndex,
              }),
              onBillChange(billData),
            ]);
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
            item.cost = Number(e.currentTarget.value) * currencyFactor;
            await Promise.all([
              supabase.from("bill_items").upsert({
                bill_id: billData.id,
                contributor_id: item.contributor_id,
                cost: item.cost,
                id: item.id,
                name: item.name,
                sort: itemIndex,
              }),
              onBillChange(billData),
            ]);
          }}
          onfocus={() => {
            selectedCoordinates = { x: 1, y: selectedItemIndex };
          }}
          title={interpolateString(strings["{item}Cost"], { item: item.name })}
          value={getNumericDisplay(
            currencyFormatter,
            parseNumericFormat(
              currencyFormatter,
              item.cost.toString(),
              CURRENCY_MIN,
              CURRENCY_MAX
            )
          )}
        />
        <EntrySelect
          {isAlternate}
          onchange={async (e) => {
            item.contributor_id = e.currentTarget.value;
            await Promise.all([
              supabase.from("bill_items").upsert({
                bill_id: billData.id,
                contributor_id: item.contributor_id,
                cost: item.cost,
                id: item.id,
                name: item.name,
                sort: itemIndex,
              }),
              onBillChange(billData),
            ]);
          }}
          onfocus={() => {
            selectedCoordinates = { x: 2, y: selectedItemIndex };
          }}
          options={billData.bill_contributors}
          title={interpolateString(strings["{item}Buyer"], { item: item.name })}
          value={item.contributor_id}
        />
        {#each item.bill_item_splits as split, splitIndex}
          <EntryInput
            formatter={INTEGER_FORMATTER}
            inputmode="numeric"
            {isAlternate}
            max={SPLIT_MAX}
            min={SPLIT_MIN}
            onchange={async (e) => {
              split.ratio = Number(e.currentTarget.value);
              await Promise.all([
                supabase.from("bill_item_splits").upsert({
                  bill_id: billData.id,
                  contributor_id: billData.bill_contributors[splitIndex]?.id,
                  id: split.id,
                  item_id: item.id,
                  ratio: split.ratio,
                }),
                onBillChange(billData),
              ]);
            }}
            onfocus={() => {
              selectedCoordinates = { x: 3 + splitIndex, y: selectedItemIndex };
            }}
            title={interpolateString(
              strings["{item}ContributionFrom{contributor}"],
              {
                contributor:
                  billData.bill_contributors[splitIndex]?.name ||
                  strings["anonymous"],
                item: item.name,
              }
            )}
            value={getNumericDisplay(
              INTEGER_FORMATTER,
              parseNumericFormat(
                currencyFormatter,
                split.ratio.toString(),
                SPLIT_MIN,
                SPLIT_MAX
              )
            )}
          />
        {/each}
      {/each}
    </div>
    <div class="actions">
      <div class="scroller">
        <Button
          onclick={async () => {
            const currentTimestamp = new Date().toISOString();
            const itemId = crypto.randomUUID();
            /**
             * Always tries to set contributor to current user ID if exists in array,
             * else do first contributor ID in array,
             * else list is empty and use current user ID again
             */
            const contributorId = billData.bill_contributors.reduce(
              (acc, curr, index) => {
                if (index === 0) {
                  acc = curr.id;
                } else if (curr.id === userId) {
                  acc = curr.id;
                }
                return acc;
              },
              userId
            );
            const newSplits = billData.bill_contributors.map((contributor) => ({
              bill_id: billData.id,
              contributor_id: contributor.id,
              id: crypto.randomUUID(),
              item_id: itemId,
              ratio: 0,
              updated_at: currentTimestamp,
            }));
            const newItem = {
              bill_id: billData.id,
              contributor_id: contributorId,
              cost: 0,
              id: itemId,
              name: interpolateString(strings["item{index}"], {
                index: String(billData.bill_items.length + 1),
              }),
              sort: billData.bill_items.length,
              updated_at: currentTimestamp,
            };
            billData.bill_items.push({
              ...newItem,
              bill_item_splits: newSplits,
            });
            await Promise.all([
              supabase.rpc("add_bill_item", {
                p_item: newItem,
                p_splits: newSplits,
              }),
              onBillChange(billData),
            ]);
          }}
        >
          <AddCircle />
          <span class="hideMobile">
            {strings["addItem"]}
          </span>
        </Button>
        <Button
          onclick={async () => {
            const currentTimestamp = new Date().toISOString();
            const contributorId = crypto.randomUUID();
            const newContributor = {
              bill_id: billData.id,
              id: contributorId,
              name: interpolateString(strings["contributor{index}"], {
                index: String(billData.bill_contributors.length + 1),
              }),
              sort: billData.bill_contributors.length,
              updated_at: currentTimestamp,
            };
            billData.bill_contributors.push(newContributor);
            const newSplits = billData.bill_items.map((item) => {
              const newSplit = {
                bill_id: billData.id,
                contributor_id: contributorId,
                id: crypto.randomUUID(),
                item_id: item.id,
                ratio: 0,
                updated_at: currentTimestamp,
              };
              item.bill_item_splits.push(newSplit);
              return newSplit;
            });
            await Promise.all([
              supabase.rpc("add_bill_contributor", {
                p_contributor: newContributor,
                p_splits: newSplits,
              }),
              onBillChange(billData),
            ]);
          }}
        >
          <AddUser />
          <span class="hideMobile">
            {strings["addContributor"]}
          </span>
        </Button>
        {#if selectedCoordinates !== null}
          {#if selectedCoordinates.y > 0 && billData.bill_items.length > 1}
            <Button
              color="error"
              onclick={async () => {
                if (selectedCoordinates) {
                  const [deletedItem] = billData.bill_items.splice(
                    selectedCoordinates.y - 1,
                    1
                  );

                  selectedCoordinates = null;
                  await Promise.all([
                    supabase.rpc("delete_bill_item", {
                      p_item_id: deletedItem.id,
                    }),
                    onBillChange(billData),
                  ]);
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
                  const selectedContributorIndex = selectedCoordinates.x - 3;
                  const selectedContributor =
                    billData.bill_contributors[selectedContributorIndex];
                  const currentContributor = billData.bill_contributors.find(
                    (contributor) => contributor.id === userId
                  );

                  const reassignToId =
                    currentContributor?.id ??
                    billData.bill_contributors[0]?.id ??
                    userId;

                  for (const item of billData.bill_items) {
                    if (item.contributor_id === selectedContributor.id) {
                      item.contributor_id = reassignToId;
                    }
                    item.bill_item_splits.splice(selectedContributorIndex, 1);
                  }
                  billData.bill_contributors.splice(
                    selectedContributorIndex,
                    1
                  );
                  selectedCoordinates = null;
                  await Promise.all([
                    supabase.rpc("delete_bill_contributor", {
                      p_contributor_id: selectedContributor.id,
                      p_reassign_to_id: reassignToId,
                    }),
                    onBillChange(billData),
                  ]);
                }
              }}
            >
              <MinusUser />
              <span class="hideMobile">
                {interpolateString(strings["remove{item}"], {
                  item: billData.bill_contributors[selectedCoordinates.x - 3]
                    .name,
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
              (
                document.getElementById("summaryDialog") as HTMLDialogElement
              ).showModal();
              contributorSummaryIndex = index;
            }}
          >
            <span
              >{getNumericDisplay(
                currencyFormatter,
                contribution.paid.total
              )}</span
            >
            <span
              >{getNumericDisplay(
                currencyFormatter,
                contribution.owing.total
              )}</span
            >
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
