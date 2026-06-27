<script lang="ts">
  import type { HTMLSelectAttributes } from "svelte/elements";

  let {
    isAlternate,
    options,
    ...props
  }: {
    isAlternate?: boolean;
    options: { id: string; name: string }[];
  } & HTMLSelectAttributes = $props();
</script>

<select class={isAlternate ? "alternate" : ""} {...props}>
  {#each options as option}
    <option value={option.id}>{option.name}</option>
  {/each}
</select>

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
    }
  }
</style>
