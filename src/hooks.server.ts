import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from "$env/static/public";
import { DEFAULT_LOCALE, LOCALE_DIRECTION, isAcceptedLocale } from "$lib/utils/common/locale";
import { type Database } from "$lib/utils/models/database";
import { createServerClient } from "@supabase/ssr";
import { type Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  // ---- host canonicalization ----------------------------------------------
  // Marketing lives on cheqii.com (the landing `/`); the app lives on
  // app.cheqii.com (/cheques, /auth, /invite). Legacy *.workers.dev redirects to
  // whichever canonical host fits the path. /api/* and the manifest are excluded
  // so same-origin POSTs (e.g. /api/sync) and the manifest are never redirected.
  const { hostname, pathname } = event.url;
  if (!pathname.startsWith("/api/") && pathname !== "/app.webmanifest") {
    // `event.url.search` is read lazily (inside `to`) so this hook stays
    // prerender-safe — accessing it eagerly throws on prerendered pages, and a
    // redirect (the only place it's needed) never fires during prerender.
    const to = (host: string, path = pathname) =>
      new Response(null, {
        status: 301,
        headers: { location: `https://${host}${path}${event.url.search}` },
      });

    // Legacy pre-rename paths → cheque paths on the app host (old bookmarks,
    // installed PWAs, invite links issued before the bill→cheque rename).
    if (pathname === "/bills") return to("app.cheqii.com", "/");
    if (pathname.startsWith("/bills/"))
      return to("app.cheqii.com", `/cheques/${pathname.slice("/bills/".length)}`);

    const isAppPath =
      pathname === "/cheques" ||
      pathname.startsWith("/cheques/") ||
      pathname === "/new" ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/invite");

    if (hostname.endsWith(".workers.dev")) return to(isAppPath ? "app.cheqii.com" : "cheqii.com");
    if (hostname === "cheqii.com" && isAppPath) return to("app.cheqii.com");
    // The app home is "/" (the reroute hook renders the list there); keep one
    // canonical URL for the list by sending the bare /cheques path back to "/".
    if (hostname === "app.cheqii.com" && pathname === "/cheques") return to("app.cheqii.com", "/");
  }

  /**
   * Creates a Supabase client specific to this server request.
   *
   * The Supabase client gets the Auth token from the request cookies.
   */
  event.locals.supabase = createServerClient<Database>(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => event.cookies.getAll(),
        /**
         * SvelteKit's cookies API requires `path` to be explicitly set in
         * the cookie options. Setting `path` to `/` replicates previous/
         * standard behavior.
         */
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, options, value }) => {
            try {
              event.cookies.set(name, value, { ...options, path: "/" });
            } catch (error) {
              console.error(
                `[Supabase] Failed to set cookie ${name} for ${event.url.pathname}:`,
                error,
              );
            }
          });
        },
      },
    },
  );

  /**
   * Unlike `supabase.auth.getSession()`, which returns the session _without_
   * validating the JWT, this function also calls `getUser()` to validate the
   * JWT before returning the session.
   */
  event.locals.safeGetSession = async () => {
    const {
      data: { session },
    } = await event.locals.supabase.auth.getSession();

    if (!session) {
      return { session: null, user: null };
    }

    const {
      data: { user },
      error: userError,
    } = await event.locals.supabase.auth.getUser();

    if (userError) {
      // JWT validation has failed
      return { session, user: null };
    }

    return { session, user };
  };

  // Resolve <html lang/dir> from the locale cookie (design-system spec §5.1) —
  // logical CSS keys off `dir`, so RTL needs no component change.
  const cookieLocale = event.cookies.get("locale");
  const locale = isAcceptedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const dir = LOCALE_DIRECTION[locale];

  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace("%lang%", locale).replace("%dir%", dir),
    filterSerializedResponseHeaders(name) {
      /**
       * Supabase libraries use the `content-range` and `x-supabase-api-version`
       * headers, so we need to tell SvelteKit to pass it through.
       */
      return name === "content-range" || name === "x-supabase-api-version" || name === "set-cookie";
    },
  });
};
