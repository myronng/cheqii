<script lang="ts">
  import { setContext, type Snippet } from "svelte";
  import Popover from "$lib/components/base/Popover.svelte";

  // A dropdown menu over the native Popover primitive (light-dismiss, Esc, and
  // top-layer handling come for free). Compose with <MenuItem>; each item closes
  // the menu via the popover id we publish on context.
  let {
    id,
    label,
    trigger,
    children,
  }: {
    /** Unique popover id; shared with MenuItems so they can close the menu. */
    id: string;
    /** Accessible name for the menu (screen readers). */
    label?: string;
    /** The clickable element that opens the menu (rendered inside the trigger). */
    trigger: Snippet;
    /** The menu's <MenuItem>s. */
    children: Snippet;
  } = $props();

  setContext("menu-id", id);
</script>

<Popover {id} {trigger} role="menu" aria-label={label}>
  <div class="menu">
    {@render children()}
  </div>
</Popover>

<style>
  .menu {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-inline-size: 11rem;
  }
</style>
