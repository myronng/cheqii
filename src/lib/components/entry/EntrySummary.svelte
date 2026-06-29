<script lang="ts">
  import type { Allocations } from "$lib/domain/allocate";
  import type { ChequeData } from "$lib/state/model";

  import Button from "$lib/components/base/buttons/Button.svelte";
  import Dialog from "$lib/components/base/Dialog.svelte";
  import Input from "$lib/components/base/Input.svelte";
  import Link from "$lib/components/icons/Link.svelte";
  import ReplaceUser from "$lib/components/icons/ReplaceUser.svelte";
  import { claimPerson, updatePerson } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";
  import { getNumericDisplay } from "$lib/utils/common/formatter";
  import {
    type LocalizedStrings,
    interpolateString,
  } from "$lib/utils/common/locale";

  const app = getAppContext();

  let {
    allocations,
    chequeData,
    personSummaryIndex,
    currencyFormatter,
    strings,
    userId,
  }: {
    allocations: Allocations;
    chequeData: ChequeData;
    personSummaryIndex: number;
    currencyFormatter: Intl.NumberFormat;
    strings: LocalizedStrings;
    userId: string;
  } = $props();
  // Latch the last-shown person so the body persists through the dialog's
  // exit animation: on close the hash clears and personSummaryIndex drops to
  // -1 immediately, but the content must stay rendered for the 225ms slide-out.
  // (Only `hash` tracks the live index, so the dialog still closes correctly.)
  let displayedIndex = $state(-1);
  $effect(() => {
    if (personSummaryIndex >= 0) displayedIndex = personSummaryIndex;
  });
  const contribution = $derived(allocations.contributions.get(displayedIndex));
  // Switching who you are is only meaningful for joiners: the creator's slot id is
  // their user id (identity-bound), so they can't reassign themselves.
  const hasIdSlot = $derived(chequeData.cheque_people.some((p) => p.id === userId));
  const isYou = $derived(chequeData.cheque_people[displayedIndex]?.linked_user_id === userId);
  // Hash mirrors the selected person's id (the cheque page derives the index
  // back from it); empty when nothing is selected so the dialog stays closed.
  const hash = $derived(
    personSummaryIndex >= 0
      ? `c-${chequeData.cheque_people[personSummaryIndex].id}`
      : ""
  );
</script>

{#snippet nameField()}
  <!-- Editable person name (styled borderless like the cheque name). Focused only
       when arriving via "Add person" — tapping a chip just opens the breakdown. -->
  <span class="summary-name">
    <Input
      borderless
      onchange={async (e) => {
        const id = chequeData.cheque_people[displayedIndex]?.id;
        if (id) await updatePerson(app, chequeData.id, { id, name: e.currentTarget.value });
      }}
      placeholder={strings["anonymous"]}
      value={chequeData.cheque_people[displayedIndex]?.name ?? ""}
    />
  </span>
{/snippet}

<Dialog
  {hash}
  {strings}
  title={chequeData.cheque_people[displayedIndex]?.name ?? ""}
  titleContent={nameField}
>
  {#if displayedIndex >= 0}
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

      <!-- "Who are you" entry point — joiners can claim this person or switch to
           them from any person's breakdown (the creator's slot is identity-bound). -->
      {#if !hasIdSlot}
        {#if isYou}
          <p class="you-note"><Link />{strings["thisIsYou"]}</p>
        {:else}
          <Button
            onclick={async () => {
              await claimPerson(app, chequeData.id, {
                people: chequeData.cheque_people,
                personId: chequeData.cheque_people[displayedIndex].id,
                userId,
              });
            }}
          >
            <ReplaceUser />
            {strings["thisIsMe"]}
          </Button>
        {/if}
      {/if}
    </section>
  {/if}
</Dialog>

<style>
  /* The editable name fills the title bar (the close button takes the rest). */
  .summary-name {
    flex: 1;
    min-inline-size: 0;
  }

  .summaries {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2);
  }

  /* "This is you" — quiet confirmation in the action's place, link-coloured. */
  .you-note {
    align-items: center;
    color: var(--color-action);
    display: flex;
    font-weight: 600;
    gap: var(--space-2);
    justify-content: center;
    margin: 0;
    padding: var(--space-2);
  }

  .summary {
    background-color: var(--color-surface);
    backdrop-filter: blur(var(--surface-blur));
    border-radius: var(--radius-card);
    display: grid;
    font-family: JetBrains Mono;
    gap: var(--space-2);
    padding: var(--space-2);

    hr {
      border: 0;
      border-block-start: var(--border-divider) dashed var(--color-border);
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
      color: var(--color-text-muted);
    }

    .numeric {
      text-align: end;
    }

    .void {
      color: var(--color-text-inactive);
    }
  }
</style>
