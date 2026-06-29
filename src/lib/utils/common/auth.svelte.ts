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
/**
 * Google sign-in via the OAuth redirect flow — used everywhere (no GIS button).
 * Branches to preserve data: a signed-out visitor gets a normal `signInWithOAuth`
 * (new identity); an anonymous guest gets `linkIdentity` (same user_id, so their
 * cheques carry over — `signInWithOAuth` there would orphan them). `linkIdentity`
 * requires a session, which is why the no-session case must use `signInWithOAuth`.
 * `redirectTo` defaults to the app origin; pass the current URL to return to a
 * specific surface (e.g. the /auth chooser, so its invite redirect still fires).
 */
export async function signInWithGoogle(
  supabase: SupabaseClient,
  redirectTo: string = window.location.origin,
): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) console.error("Error getting session", error);
  if (!data.session) {
    await supabase.auth.signInWithOAuth({ options: { redirectTo }, provider: "google" });
  } else if (data.session.user.is_anonymous) {
    const { error: linkError } = await supabase.auth.linkIdentity({
      options: { redirectTo },
      provider: "google",
    });
    if (linkError) console.error("Error linking Google identity", linkError);
  }
}

export async function signOut(supabase: SupabaseClient): Promise<void> {
  await supabase.auth.signOut();
  // Hard reload to the root so all in-memory state (AppState, the resolved
  // identity, IndexedDB handles) is rebuilt from a clean, signed-out slate. On the
  // app subdomain "/" reroutes to the cheques area, which gates to /auth.
  window.location.assign("/");
}

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
