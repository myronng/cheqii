<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  let {
    borderless = false,
    onfocus,
    value = $bindable(),
    ...props
  }: { borderless?: boolean } & HTMLInputAttributes = $props();
</script>

<input
  class={borderless ? "borderless" : undefined}
  bind:value
  onfocus={(e) => {
    const target = e.currentTarget;
    onfocus?.(e);
    if (props.readonly) {
      requestAnimationFrame(() => {
        target.select();
      });
    }
  }}
  type="text"
  {...props}
/>

<style>
  input {
    background-color: transparent;
    border: var(--border-divider) solid var(--color-border);
    border-radius: 100vw;
    color: currentColor;
    font: inherit;
    inline-size: 100%;
    outline: 0;
    padding-block: var(--space-2);
    padding-inline: calc(var(--space-2) * 2);

    &:hover:not(:focus-within),
    &:hover:read-only,
    &:focus-within:read-only {
      border-color: var(--color-border-strong);
    }

    &:focus-within:not(:read-only) {
      border-color: var(--color-action);
    }

    &::placeholder {
      color: var(--color-text-muted);
    }
  }

  /* Borderless: editable but chrome-free (the cheque-name field in the header).
     Keeps a transparent border so the box doesn't shift when a hover/focus tint
     is applied, and only hints an outline on focus. */
  input.borderless {
    border-color: transparent;
    border-radius: var(--space-1);
    padding-inline: var(--space-2);

    &:hover:not(:focus-within),
    &:hover:read-only,
    &:focus-within:read-only {
      border-color: transparent;
      background-color: var(--color-surface-hover);
    }

    &:focus-within:not(:read-only) {
      background-color: var(--color-surface-active);
      border-color: transparent;
    }
  }
</style>
