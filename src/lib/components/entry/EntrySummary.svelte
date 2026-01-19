<script lang="ts">
  import type { Allocations } from "$lib/utils/common/allocate";
  import type { BillData } from "$lib/utils/models/bill.svelte";

  import Dialog from "$lib/components/base/Dialog.svelte";
  import { getNumericDisplay } from "$lib/utils/common/formatter";
  import {
    type LocalizedStrings,
    interpolateString,
  } from "$lib/utils/common/locale";

  let {
    allocations,
    billData,
    contributorSummaryIndex,
    currencyFormatter,
    strings,
  }: {
    allocations: Allocations;
    billData: BillData;
    contributorSummaryIndex: number;
    currencyFormatter: Intl.NumberFormat;
    strings: LocalizedStrings;
  } = $props();
  const contribution = $derived(
    allocations.contributions.get(contributorSummaryIndex)
  );
</script>

<Dialog
  id="summaryDialog"
  {strings}
  title={contributorSummaryIndex >= 0
    ? billData.bill_contributors[contributorSummaryIndex].name
    : ""}
>
  {#if contributorSummaryIndex >= 0}
    <section class="summaries">
      {#if contribution}
        <article class="summary paid">
          <span class="disabled">
            {strings["paid"]}
          </span>
          <span class="disabled numeric">
            {strings["cost"]}
          </span>
          {#each contribution.paid.items as paidItem}
            {@const isVoid = paidItem.cost === 0}
            <span class={isVoid ? "void" : undefined}>
              {paidItem.name}
            </span>
            <span class={isVoid ? "numeric void" : "numeric"}>
              {getNumericDisplay(currencyFormatter, paidItem.cost)}
            </span>
          {/each}
          <hr />
          <span class="disabled">{strings["subtotal"]}</span>
          <span
            >{getNumericDisplay(
              currencyFormatter,
              contribution.paid.total
            )}</span
          >
        </article>
        <article class="summary owing">
          <span class="disabled">
            {strings["owing"]}
          </span>
          <span class="disabled"></span>
          <span class="disabled numeric">
            {strings["cost"]}
          </span>
          {#each contribution.owing.items as owingItem}
            {@const isVoid =
              owingItem.cost === 0 ||
              owingItem.split.denominator === 0 ||
              owingItem.split.multiplicand === 0 ||
              owingItem.split.numerator === 0}
            <span class={isVoid ? "void" : undefined}>
              {owingItem.name}
            </span>
            <span class={isVoid ? "numeric void" : "disabled numeric"}>
              {interpolateString(
                strings[
                  "owingCalculation{multiplicand}{numerator}{denominator}"
                ],
                {
                  denominator: owingItem.split.denominator.toString(),
                  multiplicand: getNumericDisplay(
                    currencyFormatter,
                    owingItem.split.multiplicand
                  ),
                  numerator: owingItem.split.numerator.toString(),
                }
              )}
            </span>
            <span class={isVoid ? "numeric void" : "numeric"}>
              {getNumericDisplay(currencyFormatter, owingItem.cost)}
            </span>
          {/each}
          <hr />
          <span class="disabled">{strings["subtotal"]}</span>
          <span class="disabled"></span>
          <span
            >{getNumericDisplay(
              currencyFormatter,
              contribution.owing.total
            )}</span
          >
        </article>
        <article class="summary balance">
          <span class="disabled">
            {strings["balance"]}
          </span>
          <span class="disabled numeric">
            {interpolateString(
              strings["balanceCalculation{subtrahend}{minuend}"],
              {
                minuend: getNumericDisplay(
                  currencyFormatter,
                  contribution.owing.total
                ),
                subtrahend: getNumericDisplay(
                  currencyFormatter,
                  contribution.paid.total
                ),
              }
            )}
          </span>
          <span class="numeric">
            {getNumericDisplay(
              currencyFormatter,
              contribution.paid.total - contribution.owing.total
            )}
          </span>
        </article>
      {/if}
    </section>
  {/if}
</Dialog>

<style>
  .summaries {
    display: flex;
    flex-direction: column;
    gap: var(--length-spacing);
    padding: var(--length-spacing);
  }

  .summary {
    background-color: var(--color-background-surface);
    backdrop-filter: blur(var(--length-surface-blur));
    border-radius: var(--length-radius);
    display: grid;
    font-family: JetBrains Mono;
    gap: var(--length-spacing);
    padding: var(--length-spacing);

    hr {
      border: 0;
      border-block-start: var(--length-divider) dashed var(--color-divider);
      grid-column: 1 / -1;
    }

    &.balance,
    &.owing {
      grid-template-columns: 1fr max-content max-content;
    }

    &.paid {
      grid-template-columns: 1fr max-content;
    }

    .disabled {
      color: var(--color-font-disabled);
    }

    .numeric {
      text-align: end;
    }

    .void {
      color: var(--color-font-inactive);
    }
  }
</style>
