<!--
  Cheque listing: a responsive card grid + a "Start a cheque" CTA in the title row,
  with client-side pagination over the in-memory list, or an empty state when none.
-->
<script lang="ts">
  import MainCheque from "$lib/components/main/MainCheque.svelte";
  import { GUEST_CHEQUE_CAP } from "$lib/state/actions";
  import type { ChequeData } from "$lib/state/model";
  import { type LocalizedStrings } from "$lib/utils/common/locale";

  let {
    chequeList,
    isGuest = false,
    userId,
    strings,
  }: {
    chequeList: ChequeData[];
    /** Guests see the cheque cap alongside the count ("4 / 6"). */
    isGuest?: boolean;
    userId: string;
    strings: LocalizedStrings;
  } = $props();

  // Lists can grow large; paginate the in-memory array (no fetch). 12/page fills a
  // clean grid on wide screens (≈4 rows × 3 cols).
  const PAGE_SIZE = 12;
  let pageIndex = $state(0);
  const totalPages = $derived(Math.max(1, Math.ceil(chequeList.length / PAGE_SIZE)));
  const clamped = $derived(Math.min(Math.max(pageIndex, 0), totalPages - 1));
  const pageCheques = $derived(
    chequeList.slice(clamped * PAGE_SIZE, clamped * PAGE_SIZE + PAGE_SIZE),
  );
  const pageNumbers = $derived(Array.from({ length: totalPages }, (_, i) => i));
</script>

{#if chequeList.length === 0}
  <div class="empty">
    <div class="empty-card">
      <h2 class="empty-title">{strings["noChequesYet"]}</h2>
      <p class="empty-sub">{strings["startYourFirstCheque"]}</p>
      <a class="cta" href="/new">{strings["startACheque"]}</a>
    </div>
    <p class="empty-hint">{strings["alreadyHaveChequesHint"]}</p>
  </div>
{:else}
  <div class="listing">
    <div class="title-row">
      <div class="title-group">
        <h1 class="title">{strings["yourCheques"]}</h1>
        <span class="count"
          >{isGuest ? `${chequeList.length} / ${GUEST_CHEQUE_CAP}` : chequeList.length}</span
        >
      </div>
      <a class="cta" href="/new">{strings["startACheque"]}</a>
    </div>

    <div class="grid">
      {#each pageCheques as cheque (cheque.id)}
        <MainCheque {cheque} {userId} {strings} />
      {/each}
    </div>

    {#if totalPages > 1}
      <div class="pager">
        <button
          class="pager-nav"
          onclick={() => (pageIndex = clamped - 1)}
          disabled={clamped === 0}>{strings["previous"]}</button
        >
        {#each pageNumbers as n}
          <button class="pager-btn" class:active={n === clamped} onclick={() => (pageIndex = n)}>
            {n + 1}
          </button>
        {/each}
        <button
          class="pager-nav"
          onclick={() => (pageIndex = clamped + 1)}
          disabled={clamped === totalPages - 1}>{strings["next"]}</button
        >
      </div>
    {/if}
  </div>
{/if}

<style>
  .listing {
    /* Full-width with the same all-sides padding as the header, so edges + CTAs
       line up at every width. */
    padding: var(--space-2);
  }

  .title-row {
    align-items: center;
    display: flex;
    gap: var(--space-4);
    justify-content: space-between;
  }
  .title-group {
    align-items: baseline;
    display: flex;
    /* Wider breathing room between the heading and the count. */
    gap: var(--space-4);
  }
  .title {
    font-size: var(--text-2xl);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
  }
  .count {
    color: var(--color-text-muted);
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-base);
  }

  /* Filled brand CTA, shared by the title row + the empty state (matches landing). */
  .cta {
    background: var(--color-action);
    border-radius: 100vw;
    color: var(--color-on-action);
    display: inline-flex;
    flex-shrink: 0;
    font-weight: 700;
    padding: var(--space-3) var(--space-5);
    text-decoration: none;
    white-space: nowrap;

    @media (prefers-reduced-motion: no-preference) {
      transition: background-color var(--dur-fast) var(--ease-standard);
    }
  }
  .cta:hover {
    background: var(--color-action-hover);
  }
  .cta:active {
    background: var(--color-action-active);
  }

  .grid {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
    padding: var(--space-4);
  }

  /* pagination */
  .pager {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: center;
    margin-block-start: var(--space-6);
  }
  .pager-btn,
  .pager-nav {
    background: transparent;
    block-size: 2.5rem;
    border: var(--border-divider) solid var(--color-border);
    border-radius: 100vw;
    color: var(--color-text);
    cursor: pointer;
    font: inherit;
    font-size: var(--text-sm);
    padding-inline: var(--space-4);
  }
  .pager-btn {
    font-weight: 700;
    min-inline-size: 2.5rem;
    padding-inline: var(--space-3);
  }
  .pager-btn.active {
    background: var(--color-action);
    border-color: var(--color-action);
    color: var(--color-on-action);
  }
  .pager-nav:disabled {
    cursor: default;
    opacity: 0.4;
  }

  /* empty state — card + hint centered as a group, text left-aligned. */
  .empty {
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    min-block-size: 60vh;
    padding: var(--space-2);
  }
  .empty-card {
    border: var(--border-divider) dashed var(--color-border);
    border-radius: var(--radius-card);
    inline-size: 100%;
    max-inline-size: 28rem;
    padding: var(--space-6);
    text-align: start;
  }
  .empty-title {
    font-size: var(--text-xl);
    font-weight: 700;
    margin: 0 0 var(--space-2);
  }
  .empty-sub {
    color: var(--color-text-muted);
    line-height: 1.55;
    margin: 0 0 var(--space-5);
  }
  .empty-hint {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    inline-size: 100%;
    margin-block-start: var(--space-5);
    max-inline-size: 28rem;
    text-align: start;
  }
</style>
