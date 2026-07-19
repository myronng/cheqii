<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  // A single row in a <Menu>. Closes the menu on activation via the native popover
  // (popovertarget) using the id the parent Menu published on context, then runs
  // its own onclick.
  let {
    children,
    color,
    icon,
    ...props
  }: {
    children: Snippet;
    /** "error" tints the row red for destructive actions (e.g. log out). */
    color?: "default" | "error";
    icon?: Snippet;
  } & HTMLButtonAttributes = $props();

  const menuId = getContext<string>("menu-id");
</script>

<button
  class="item"
  class:error={color === "error"}
  popovertarget={menuId}
  popovertargetaction="hide"
  role="menuitem"
  type="button"
  {...props}
>
  {@render icon?.()}
  {@render children()}
</button>

<style>
  .item {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--radius-card);
    color: var(--color-text);
    cursor: pointer;
    display: flex;
    font: inherit;
    font-family: Comfortaa;
    font-weight: 600;
    gap: var(--space-2);
    inline-size: 100%;
    padding: var(--space-2);
    text-align: start;

    @media (prefers-reduced-motion: no-preference) {
      transition: background-color var(--dur-fast) var(--ease-standard);
    }

    &:hover,
    &:focus-visible {
      background-color: var(--color-surface-hover);
    }
    &:active {
      background-color: var(--color-surface-active);
    }

    &.error {
      color: var(--color-error);
    }
  }
</style>
