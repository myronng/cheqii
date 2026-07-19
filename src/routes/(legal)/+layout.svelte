<script lang="ts">
  import SiteHeader from "$lib/components/marketing/SiteHeader.svelte";
  import { DEFAULT_LOCALE, LOCALE_MASTER } from "$lib/utils/common/locale";

  let { children } = $props();
  // Single-locale, prerendered: resolve copy from the locale master at build.
  const strings = LOCALE_MASTER[DEFAULT_LOCALE];
</script>

<SiteHeader {strings} />
<main class="prose">
  {@render children()}
</main>

<style>
  .prose {
    margin-inline: auto;
    max-inline-size: 48rem;
    padding: var(--space-6) var(--space-4) calc(var(--space-6) * 2);
  }

  /* Readable long-form defaults for the legal copy. */
  .prose :global(h1) {
    font-size: var(--text-3xl);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-block-end: var(--space-2);
  }
  .prose :global(.updated) {
    color: var(--color-text-muted);
    margin-block-end: var(--space-5);
  }
  .prose :global(h2) {
    font-size: var(--text-xl);
    font-weight: 700;
    margin-block: var(--space-6) var(--space-2);
  }
  .prose :global(p),
  .prose :global(li) {
    color: var(--color-text);
    line-height: 1.6;
  }
  .prose :global(p) {
    margin-block-end: var(--space-3);
  }
  .prose :global(ul) {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-block-end: var(--space-3);
    padding-inline-start: var(--space-5);
  }
  .prose :global(a) {
    color: var(--color-action);
  }
  .prose :global(.note) {
    background: var(--color-surface);
    border-radius: var(--radius-card);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    margin-block-end: var(--space-5);
    padding: var(--space-3) var(--space-4);
  }
</style>
