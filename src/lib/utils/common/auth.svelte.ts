import { invalidate } from "$app/navigation";
import { PUBLIC_TURNSTILE_SITE_KEY } from "$env/static/public";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TURNSTILE_CONTAINER_ID = "turnstile-container";

/** The Turnstile script loads async; wait for it before rendering a widget. */
function waitForTurnstile(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.turnstile) return resolve();
    const start = Date.now();
    const id = setInterval(() => {
      if (typeof window !== "undefined" && window.turnstile) {
        clearInterval(id);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(id);
        reject(new Error("Turnstile script failed to load"));
      }
    }, 50);
  });
}

/**
 * Anonymous sign-in gated by an invisible Cloudflare Turnstile (auth spec §3.1).
 * In v2 the `handle_new_user` trigger creates the `public.users` row, so there's
 * no manual insert; `invalidate("supabase:auth")` re-runs the layout load and
 * AppState's auth watcher resolves the new identity + hydrates.
 *
 * Offline fallback (mint a local-only user when Turnstile/network is unavailable)
 * is the deferred "offline-user recovery" item — see REBUILD-STATUS DEFERRED.
 */
export async function signInAnonymously(supabase: SupabaseClient): Promise<void> {
  await waitForTurnstile();
  return new Promise<void>((resolve, reject) => {
    try {
      window.turnstile.render(`#${TURNSTILE_CONTAINER_ID}`, {
        sitekey: PUBLIC_TURNSTILE_SITE_KEY,
        callback: async (token: string) => {
          const { error } = await supabase.auth.signInAnonymously({
            options: { captchaToken: token },
          });
          if (error) {
            window.turnstile.reset(`#${TURNSTILE_CONTAINER_ID}`);
            reject(error);
            return;
          }
          await invalidate("supabase:auth");
          resolve();
        },
        "error-callback": (err) => reject(new Error(`Turnstile error: ${err}`)),
        theme: (document.documentElement.dataset.theme as Turnstile.Theme) || "auto",
        // No `size: "invisible"` — Turnstile's render API only accepts
        // normal/compact/flexible; invisible/managed behavior comes from the
        // site-key type, not this param (it threw "Invalid value for size").
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
