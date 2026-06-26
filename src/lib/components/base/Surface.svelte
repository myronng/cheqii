<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  // Tokenized glass surface (design-system spec §3.5) — one place for the
  // backdrop-blur + alpha-overlay treatment that recurs in EntrySummary/Payments,
  // instead of repeating backdrop-filter + bg per component.
  let { children, ...props }: { children: Snippet } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class="surface" {...props}>
  {@render children()}
</div>

<style>
  .surface {
    background-color: var(--color-surface);
    border-radius: var(--radius-card);

    /* Glass effect only where supported and motion/transparency is welcome. */
    @supports (backdrop-filter: blur(1px)) {
      backdrop-filter: blur(var(--surface-blur));
    }
  }
</style>
