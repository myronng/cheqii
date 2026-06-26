import { invalidate } from "$app/navigation";
import { PUBLIC_TURNSTILE_SITE_KEY } from "$env/static/public";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TURNSTILE_CONTAINER_ID = "turnstile-container";

/**
 * Anonymous sign-in gated by an invisible Cloudflare Turnstile (auth spec §3.1).
 * In v2 the `handle_new_user` trigger creates the `public.users` row, so there's
 * no manual insert; `invalidate("supabase:auth")` re-runs the layout load and
 * AppState's auth watcher resolves the new identity + hydrates.
 *
 * Offline fallback (mint a local-only user when Turnstile/network is unavailable)
 * is the deferred "offline-user recovery" item — see REBUILD-STATUS DEFERRED.
 */
export function signInAnonymously(supabase: SupabaseClient): Promise<void> {
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
        size: "invisible" as unknown as Turnstile.RenderParameters["size"],
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
