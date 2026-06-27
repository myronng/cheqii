<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLLabelAttributes } from "svelte/elements";

  // One source of truth for form-field look (design-system spec §6): a <label>
  // wrapping a native control (passed as children) + Constraint Validation
  // styling. The native control keeps its own semantics/validation; Field just
  // supplies the label, layout, optional hint, and the :user-invalid affordance.
  let {
    label,
    hint,
    children,
    ...props
  }: { label: string; hint?: string; children: Snippet } & HTMLLabelAttributes = $props();
</script>

<label class="field" {...props}>
  <span class="label">{label}</span>
  {@render children()}
  {#if hint}<span class="hint">{hint}</span>{/if}
</label>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .label {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .hint {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  /* Constraint Validation feedback — applies once the user has interacted, so
     valid-by-default fields don't show errors on first paint. */
  .field :global(input:user-invalid),
  .field :global(select:user-invalid),
  .field :global(textarea:user-invalid) {
    border-color: var(--color-error);
  }

  .field:has(:user-invalid) .hint {
    color: var(--color-error);
  }
</style>
