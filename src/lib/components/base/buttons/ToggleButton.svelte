<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  let {
    children,
    padding = 1,
    ...props
  }: {
    padding?: number;
  } & HTMLInputAttributes = $props();
</script>

<label style:--padding={padding}>
  <input type="radio" {...props} />
  {@render children?.()}
</label>

<style>
  label {
    align-items: center;
    background-color: transparent;
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    color: var(--color-action);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    font: inherit;
    font-family: Comfortaa;
    font-weight: 700;
    gap: var(--space-2);
    justify-content: center;
    max-inline-size: 300px;
    padding-block: calc(var(--space-2) * var(--padding));
    padding-inline: calc(var(--space-2) * 2 * var(--padding));

    @media (prefers-reduced-motion: no-preference) {
      transition:
        ease background-color 75ms,
        border-color 75ms;
    }

    &:has(input:disabled) {
      color: var(--color-text-muted);
      pointer-events: none;
    }

    &:not(:has(input:disabled)) {
      cursor: pointer;

      &:active:not(:has(input:checked)) {
        background-color: var(--color-surface-active);
      }

      &:hover:not(:active):not(:has(input:checked)) {
        background-color: var(--color-surface-hover);
      }

      &:has(input:checked) {
        border-color: var(--color-action);
      }
    }

    &:has(input:checked) {
      background-color: var(--color-surface-active);
    }
  }

  input {
    appearance: none;
    display: none;
  }
</style>
