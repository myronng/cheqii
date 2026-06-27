<script lang="ts">
  import Button from "$lib/components/base/buttons/Button.svelte";
  import { getAppContext } from "$lib/state/app.svelte";
  import { DEFAULT_LOCALE, LOCALE_MASTER } from "$lib/utils/common/locale";
  import { onMount } from "svelte";

  // Install promotion + update prompt (frontend spec §3.6c/d′). Install promotion
  // is a v1 requirement: installed PWAs are exempt from iOS storage eviction.
  // No page strings in the root layout → use the default-locale master directly.
  const strings = LOCALE_MASTER[DEFAULT_LOCALE];
  const app = getAppContext();

  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  }

  let installEvent = $state<BeforeInstallPromptEvent | null>(null);
  let updateWaiting = $state<ServiceWorker | null>(null);
  let dismissed = $state(true); // until we read localStorage on mount
  let isIos = $state(false);
  let isStandalone = $state(true); // assume installed until proven otherwise

  // Surface install only AFTER the first cheque (proven value + device-only data now
  // exists), when installable (Chromium event or iOS) and not already installed.
  const showInstall = $derived(
    !isStandalone && !dismissed && app.cheques.list().length > 0 && (installEvent !== null || isIos),
  );

  onMount(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !nav.standalone;
    dismissed = localStorage.getItem("pwa-install-dismissed") === "1";

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // stash it; we drive the prompt from our own UI
      installEvent = e as BeforeInstallPromptEvent;
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

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
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      if (poll) clearInterval(poll);
    };
  });

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    void navigator.storage?.persist?.(); // pair install with persistence
  }
  function dismissInstall() {
    dismissed = true;
    localStorage.setItem("pwa-install-dismissed", "1");
  }
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
      {installEvent ? strings["installToKeepYourChequesOnThisDevice"] : strings["iosAddToHomeScreenInstructions"]}
    </span>
    {#if installEvent}
      <Button variant="primary" onclick={install}>{strings["install"]}</Button>
    {/if}
    <Button borderless onclick={dismissInstall}>{strings["dismiss"]}</Button>
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
