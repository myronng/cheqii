<script lang="ts">
  import { page } from "$app/state";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import { getAppContext } from "$lib/state/app.svelte";
  import { DEFAULT_LOCALE, LOCALE_MASTER } from "$lib/utils/common/locale";
  import { JOIN_NUDGE_KEY, pwaInstall } from "$lib/utils/common/pwa.svelte";
  import { onMount } from "svelte";

  // Install promotion + update prompt (frontend spec §3.6c/d′). Install promotion
  // is a v1 requirement: installed PWAs are exempt from iOS storage eviction.
  // Install state (event stash, cooldown, installed detection) lives in the shared
  // pwaInstall module so the account-menu item stays consistent with this banner.
  // No page strings in the root layout → use the default-locale master directly.
  const strings = LOCALE_MASTER[DEFAULT_LOCALE];
  const app = getAppContext();

  let updateWaiting = $state<ServiceWorker | null>(null);

  // Contextual surfaces: the cheque list, and the cheque a visitor just joined
  // (the invite page sets the nudge flag). `forced` (the iOS account-menu item,
  // which has no native prompt to call) overrides the route gating so the
  // instructions can appear from any page.
  let joinNudge = $state(false);
  $effect(() => {
    void page.url.pathname; // re-check on every navigation
    if (sessionStorage.getItem(JOIN_NUDGE_KEY)) {
      sessionStorage.removeItem(JOIN_NUDGE_KEY);
      joinNudge = true;
    }
  });
  const onPromotedSurface = $derived(page.url.pathname === "/cheques" || joinNudge);

  // Surface install only AFTER the first cheque (proven value + device-only data
  // now exists), on a promoted surface, when installable and not dismissed within
  // the 30-day cooldown.
  const showInstall = $derived(
    pwaInstall.canInstall &&
      (pwaInstall.forced ||
        (!pwaInstall.dismissed && onPromotedSurface && app.cheques.list().length > 0)),
  );

  onMount(() => {
    const detachInstall = pwaInstall.attach();

    let poll: ReturnType<typeof setInterval> | undefined;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        const track = () => {
          if (reg.waiting && navigator.serviceWorker.controller) updateWaiting = reg.waiting;
        };
        track();
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed") track();
          });
        });
        poll = setInterval(() => void reg.update().catch(() => {}), 60_000);
      });
      // The new SW called clients.claim() after SKIP_WAITING → reload to it once.
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
    }

    return () => {
      detachInstall();
      if (poll) clearInterval(poll);
    };
  });

  function applyUpdate() {
    updateWaiting?.postMessage("SKIP_WAITING");
  }
</script>

{#if updateWaiting}
  <div class="banner">
    <span>{strings["newVersionAvailable"]}</span>
    <Button borderless onclick={applyUpdate}>{strings["reload"]}</Button>
  </div>
{/if}

{#if showInstall}
  <div class="banner">
    <span>
      {pwaInstall.hasNativePrompt
        ? strings["installToKeepYourChequesOnThisDevice"]
        : strings["iosAddToHomeScreenInstructions"]}
    </span>
    {#if pwaInstall.hasNativePrompt}
      <Button variant="primary" onclick={() => void pwaInstall.promptInstall()}>
        {strings["install"]}
      </Button>
    {/if}
    <Button borderless onclick={() => pwaInstall.dismiss()}>{strings["dismiss"]}</Button>
  </div>
{/if}

<style>
  .banner {
    align-items: center;
    background-color: var(--color-background-raised);
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    bottom: max(var(--space-3), env(safe-area-inset-bottom));
    display: flex;
    gap: var(--space-3);
    inset-inline: var(--space-3);
    margin-inline: auto;
    max-inline-size: 32rem;
    padding: var(--space-3);
    position: fixed;
    z-index: 2000;

    @supports (backdrop-filter: blur(1px)) {
      backdrop-filter: blur(var(--surface-blur));
    }

    span {
      flex: 1;
    }
  }
</style>
