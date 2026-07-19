/**
 * Shared PWA install state — the single source of truth for every install entry
 * point (the PwaPrompts banner and the account-menu item), so the experience is
 * consistent: one stashed `beforeinstallprompt`, one dismissal cooldown, one
 * "already installed" signal.
 *
 * Installed detection: on Chromium, `beforeinstallprompt` simply never fires when
 * the app is already installed, so gating UI on `canInstall` auto-hides it there.
 * iOS has no detection API at all — we can only tell when running *inside* the
 * installed app (standalone). So on iOS Safari the entry points stay visible and
 * open the add-to-home-screen instructions.
 *
 * `attach()` must be called once from a mounted component ((app) layout via
 * PwaPrompts) so the listeners live for the app session.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
/** A banner dismissal hides install promotion for 30 days, not forever. */
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
/** Set by the invite page on a successful join; the banner shows once on arrival. */
export const JOIN_NUDGE_KEY = "pwa-join-nudge";

class PwaInstallState {
  #event = $state<BeforeInstallPromptEvent | null>(null);
  #isIos = $state(false);
  #isStandalone = $state(true); // assume installed until proven otherwise
  #installed = $state(false); // `appinstalled` fired this session
  #dismissedAt = $state<number | null>(null);
  /** iOS menu-item click: force the banner (with instructions) onto any page. */
  forced = $state(false);

  get isIos(): boolean {
    return this.#isIos;
  }
  /** True when an install UI makes sense: not installed and either the Chromium
   *  prompt is stashed or we're on iOS (instructions-only). */
  get canInstall(): boolean {
    return !this.#isStandalone && !this.#installed && (this.#event !== null || this.#isIos);
  }
  /** Chromium's native prompt is available (vs. iOS instructions). */
  get hasNativePrompt(): boolean {
    return this.#event !== null;
  }
  /** Banner dismissal within the 30-day cooldown window. */
  get dismissed(): boolean {
    return this.#dismissedAt !== null && Date.now() - this.#dismissedAt < DISMISS_COOLDOWN_MS;
  }

  /** Bind window listeners; call once from a mounted component. Returns cleanup. */
  attach(): () => void {
    const nav = navigator as Navigator & { standalone?: boolean };
    this.#isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    this.#isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !nav.standalone;

    const storedDismiss = Number(localStorage.getItem(DISMISS_KEY));
    this.#dismissedAt = Number.isFinite(storedDismiss) && storedDismiss > 0 ? storedDismiss : null;
    // Migrate the legacy boolean key ("dismissed forever"): drop it so those users
    // re-enter the cooldown world instead of never seeing the banner again.
    localStorage.removeItem("pwa-install-dismissed");

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // suppress the mini-infobar; we drive our own UI
      this.#event = e as BeforeInstallPromptEvent;
    };
    const onInstalled = () => {
      this.#installed = true;
      this.#event = null;
      this.forced = false;
      void navigator.storage?.persist?.(); // pair install with storage durability
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }

  /** Trigger install: Chromium → native prompt; iOS → surface the instructions
   *  banner (`forced`) since there's nothing to programmatically prompt. */
  async promptInstall(): Promise<void> {
    const event = this.#event;
    if (!event) {
      if (this.#isIos) this.forced = true;
      return;
    }
    await event.prompt();
    await event.userChoice;
    // A used event can't prompt again (Chromium re-fires beforeinstallprompt
    // later if the user declined); `appinstalled` handles the accepted case.
    this.#event = null;
    void navigator.storage?.persist?.();
  }

  /** Dismiss the banner for the cooldown period. */
  dismiss(): void {
    this.#dismissedAt = Date.now();
    this.forced = false;
    localStorage.setItem(DISMISS_KEY, String(this.#dismissedAt));
  }
}

export const pwaInstall = new PwaInstallState();
