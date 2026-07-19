<script lang="ts">
  import type { HTMLSelectAttributes } from "svelte/elements";

  import ChevronDown from "$lib/components/icons/ChevronDown.svelte";

  let {
    chevron = false,
    isAlternate,
    options,
    ...props
  }: {
    /** Action-coloured with a down chevron, so it reads as a dropdown (cards). */
    chevron?: boolean;
    isAlternate?: boolean;
    options: { id: string; name: string }[];
  } & HTMLSelectAttributes = $props();
</script>

{#snippet opts()}
  {#each options as option}
    <option value={option.id}>{option.name}</option>
  {/each}
{/snippet}

{#if chevron}
  <span class="wrap">
    <select class="action" {...props}>{@render opts()}</select>
    <span class="chev" aria-hidden="true"><ChevronDown /></span>
  </span>
{:else}
  <select class={isAlternate ? "alternate" : ""} {...props}>{@render opts()}</select>
{/if}

<style>
  select {
    appearance: none;
    background-color: transparent;
    border: none;
    color: currentColor;
    cursor: pointer;
    font: inherit;
    outline-offset: calc(var(--border-divider) * -1);
    padding-block: calc(var(--space-2) * 0.5);
    padding-inline: var(--space-2);

    @media (prefers-reduced-motion: no-preference) {
      transition: ease background-color 75ms;
    }

    &:hover:not(:focus-within) {
      background-color: var(--color-surface-hover);
    }

    &:focus-within {
      background-color: var(--color-surface-active);
      color: var(--color-text);
      outline: var(--border-divider) solid var(--color-action);
    }

    &.alternate:not(:hover):not(:focus-within) {
      background-color: var(--color-background-raised);
    }

    & option {
      background-color: var(--color-background);
      /* Keep the popup list readable even when the closed control is tinted. */
      color: var(--color-text);
    }
  }

  /* chevron variant: action-coloured value + a trailing down chevron */
  .wrap {
    align-items: center;
    display: inline-flex;
    position: relative;
  }
  select.action {
    color: var(--color-action);
    /* Size to the selected option (not the widest) so the chevron sits right
       after the text. Falls back to the default width where unsupported. */
    field-sizing: content;
    padding-inline-end: calc(var(--space-2) + var(--text-base));

    &:focus-within {
      color: var(--color-action);
    }
  }
  .chev {
    align-items: center;
    color: var(--color-action);
    display: inline-flex;
    font-size: var(--text-sm);
    inset-inline-end: var(--space-1);
    pointer-events: none;
    position: absolute;
  }
</style>
