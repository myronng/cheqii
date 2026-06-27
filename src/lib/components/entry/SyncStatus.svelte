<script lang="ts">
  import { getAppContext } from "$lib/state/app.svelte";
  import type { LocalizedStrings } from "$lib/utils/common/locale";

  // Surfaces the sync engine's coarse status (observability). The engine also
  // tracks cumulative metrics (sync.metrics) and the server logs a structured
  // line per /api/sync round for Cloudflare observability.
  let { strings }: { strings: LocalizedStrings } = $props();
  const app = getAppContext();
  const status = $derived(app.sync?.status ?? "syncing");
  const label = $derived(
    status === "synced"
      ? strings["synced"]
      : status === "syncing"
        ? strings["syncing"]
        : status === "offline"
          ? strings["offline"]
          : status === "error"
            ? strings["syncError"]
            : strings["unsyncedChanges"],
  );
</script>

<span class="sync {status}" aria-label={label} role="status" title={label}>
  <span class="dot"></span>
</span>

<style>
  .sync {
    align-items: center;
    color: var(--color-font-disabled);
    display: inline-flex;
    justify-content: center;
    padding: var(--length-spacing);
  }

  .dot {
    background-color: currentColor;
    block-size: 0.6rem;
    border-radius: 50%;
    inline-size: 0.6rem;
  }

  .synced {
    color: var(--color-action);
  }

  .error {
    color: var(--color-feedback-error);
  }

  .syncing .dot {
    @media (prefers-reduced-motion: no-preference) {
      animation: pulse 1s ease-in-out infinite;
    }
  }

  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }
</style>
