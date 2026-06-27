<!--
  Cheque listing: a responsive card grid (with a "new cheque" tile) plus client
  -side pagination over the in-memory list, or an empty state when there are none.
-->
<script lang="ts">
  import Add from "$lib/components/icons/Add.svelte";
  import MainCheque from "$lib/components/main/MainCheque.svelte";
  import type { ChequeData } from "$lib/state/model";
  import { type LocalizedStrings } from "$lib/utils/common/locale";

  let {
    chequeList,
    userId,
    strings,
  }: {
    chequeList: ChequeData[];
    userId: string;
    strings: LocalizedStrings;
  } = $props();

  // Lists can grow large; paginate the in-memory array (no fetch). Page size is
  // tuned so page 1 + the "new cheque" tile fills a clean grid on wide screens.
  const PAGE_SIZE = 11;
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
      <a class="empty-cta" href="/new">{strings["startACheque"]}</a>
    </div>
    <p class="empty-hint">{strings["alreadyHaveChequesHint"]}</p>
  </div>
{:else}
  <div class="listing">
    <div class="title-row">
      <h1 class="title">{strings["yourCheques"]}</h1>
      <span class="count">{chequeList.length}</span>
    </div>

    <div class="grid">
      <a class="new-tile" href="/new">
        <span class="new-circle"><Add /></span>
        <span class="new-label">{strings["newCheque"]}</span>
      </a>
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
    inline-size: 100%;
    max-inline-size: 78rem;
  }

  .title-row {
    align-items: baseline;
    display: flex;
    gap: var(--space-2);
    margin-block-end: var(--space-5);
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

  .grid {
    display: grid;
    gap: var(--space-5);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  }

  /* new cheque tile */
  .new-tile {
    align-items: center;
    border: var(--border-divider) dashed var(--color-border);
    border-radius: var(--radius-card);
    color: var(--color-action);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    justify-content: center;
    min-block-size: 14rem;
    text-decoration: none;
    transition:
      background-color var(--dur-base) var(--ease-standard),
      border-color var(--dur-base) var(--ease-standard);
  }
  .new-tile:hover {
    background: var(--color-surface);
    border-color: var(--color-action);
  }
  .new-circle {
    align-items: center;
    border: var(--border-divider) solid var(--color-action);
    border-radius: 50%;
    display: flex;
    font-size: var(--text-xl);
    justify-content: center;
    padding: var(--space-2);
  }
  .new-label {
    font-size: var(--text-base);
    font-weight: 700;
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
    color: var(--white);
  }
  .pager-nav:disabled {
    cursor: default;
    opacity: 0.4;
  }

  /* empty state */
  /* Card + hint are centered as a group, but their text reads left-aligned. */
  .empty {
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    min-block-size: 60vh;
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
  .empty-cta {
    background: var(--color-action);
    border-radius: 100vw;
    color: var(--white);
    display: inline-flex;
    font-weight: 700;
    padding: var(--space-3) var(--space-5);
    text-decoration: none;
    /* the one kept flourish, consistent with the landing CTA */
    box-shadow: 0 var(--space-2) calc(var(--space-5) + var(--space-1)) calc(var(--space-0) * -1)
      var(--color-action);
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
