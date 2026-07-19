<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  // Dialog/wizard footer with the progression-button convention (design-system
  // spec §5.2): the forward/primary action sits on the inline-end, back/secondary
  // on the inline-start. Both are *logical* sides, so the bar mirrors under RTL
  // with zero extra code. DOM order is [secondary, primary] = reading/tab order;
  // placement is pure layout (the secondary slot is pushed to inline-start).
  let {
    primary,
    secondary,
    ...props
  }: { primary: Snippet; secondary?: Snippet } & HTMLAttributes<HTMLElement> = $props();
</script>

<footer class="action-bar" {...props}>
  {#if secondary}
    <div class="secondary">{@render secondary()}</div>
  {/if}
  {@render primary()}
</footer>

<style>
  .action-bar {
    align-items: center;
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
    padding-block: var(--space-2);
  }

  /* Push the back/secondary action to the inline-start; mirrors automatically. */
  .secondary {
    margin-inline-end: auto;
  }
</style>
