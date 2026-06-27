<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  let {
    onfocus,
    value = $bindable(),
    ...props
  }: HTMLInputAttributes = $props();
</script>

<input
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
</style>
