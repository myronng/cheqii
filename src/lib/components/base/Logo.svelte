<script lang="ts">
  import type { LocalizedStrings } from "$lib/utils/common/locale";

  let {
    hasLink = true,
    hasTitle = true,
    href = "/",
    strings,
  }: {
    hasLink?: boolean;
    hasTitle?: boolean;
    /** Where the logo links (default the current site root; legal/auth pages point
        it at the marketing site). */
    href?: string;
    strings: LocalizedStrings;
  } = $props();
</script>

{#if hasLink}
  <a
    {href}
    style:border-radius={hasTitle ? "var(--radius-card)" : "50%"}
    title={strings["home"]}
  >
    <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <circle cx="56" cy="128" r="26" />
      <line
        stroke-linecap="round"
        stroke-width="40"
        x1="88"
        x2="200"
        y1="180"
        y2="80"
      />
    </svg>
    {#if hasTitle}
      <h1>{strings["appName"]}</h1>
    {/if}
  </a>
{:else}
  <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <circle cx="56" cy="128" r="26" />
    <line
      stroke-linecap="round"
      stroke-width="40"
      x1="88"
      x2="200"
      y1="180"
      y2="80"
    />
  </svg>
{/if}

<style>
  a {
    align-items: center;
    border-radius: 50%;
    display: flex;
    gap: var(--space-2);
    text-decoration: none;
  }

  /* Size the mark for BOTH branches (linked + bare). When this lived under `a`
     the bare-svg variant used on /auth had no size and ballooned to fill the
     container. */
  svg {
    block-size: 48px;
    inline-size: 48px;
  }

  circle {
    fill: var(--color-action);
  }

  h1 {
    color: var(--color-action);
    font-family: "Comfortaa";
    font-size: 26px;
    line-height: 1.25;
    margin: 0;
  }

  line {
    stroke: var(--color-action-secondary);
  }
</style>
