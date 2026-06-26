<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  // Menus/tooltips via the native Popover API (frontend spec §4, rung 3) — light
  // dismiss, top-layer, and Esc handling for free, no bespoke click-outside or
  // focus-trap code. Anchored to its trigger with CSS anchor positioning (rung 2)
  // where supported; falls back to the UA-centered popover otherwise.
  let {
    id,
    trigger,
    children,
    ...props
  }: { id: string; trigger: Snippet; children: Snippet } & HTMLAttributes<HTMLDivElement> =
    $props();

  const anchor = $derived(`--anchor-${id}`);
</script>

<button class="trigger" popovertarget={id} style:anchor-name={anchor} type="button">
  {@render trigger()}
</button>

<div {id} class="popover" popover style:position-anchor={anchor} {...props}>
  {@render children()}
</div>

<style>
  .trigger {
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
    font: inherit;
    padding: 0;
  }

  .popover {
    background-color: var(--color-background-raised);
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    color: inherit;
    padding: var(--space-2);

    /* Anchor below the trigger, aligned to its inline-end; mirrors under RTL. */
    @supports (position-anchor: --x) {
      inset: auto;
      margin: 0;
      margin-block-start: var(--space-1);
      position-area: block-end span-inline-start;
    }
  }
</style>
