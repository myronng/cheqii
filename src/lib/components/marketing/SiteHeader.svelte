<!--
  Bare site header: just the Cheqii logo, top-left, no right-side actions. Used by
  the auth + legal pages. The logo links to the marketing site (cheqii.com) rather
  than the app, since these pages belong to the public/marketing surface.
-->
<script lang="ts">
  import Logo from "$lib/components/base/Logo.svelte";
  import type { LocalizedStrings } from "$lib/utils/common/locale";

  let { strings }: { strings: LocalizedStrings } = $props();

  const MARKETING_URL = "https://cheqii.com";
</script>

<header class="header">
  <Logo href={MARKETING_URL} {strings} />
</header>

<style>
  /* Matches the app's header shell: logo top-left, 64px bar, divider underneath. */
  .header {
    background-color: var(--color-background);
    display: flex;
    gap: var(--space-2);
    min-block-size: 64px;
    padding: var(--space-2);
    position: sticky;
    top: 0;
    z-index: 1000;
  }
  .header::after {
    background: var(--color-border);
    block-size: var(--border-divider);
    content: "";
    inset-block-end: 0;
    inset-inline: 0;
    position: absolute;
  }
</style>
