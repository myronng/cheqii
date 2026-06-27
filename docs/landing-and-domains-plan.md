# Plan — marketing landing at root + app subdomain + domain migration

Goal: `cheqii.com/` = marketing landing (public, SEO-friendly); `app.cheqii.com` =
the application; migrate off `cheqii.myronng5.workers.dev` → `cheqii.com`.

## The core constraint

Today the whole SvelteKit app is `ssr=false` (SPA) and **boots the app context
(IndexedDB + Supabase + sync) on every route** via the root layout, and the app
home (bill list) sits at `/`. A marketing landing must instead be **prerendered**
(server-rendered at build for SEO + instant first paint) and must **not** boot the
app. So the landing has to live _outside_ the app's boot/ssr layout — which means
the app's routes move under a route group and the app "home" moves off `/`.

## Recommended architecture: one app, one Worker, both domains

```
src/routes/
  +layout.svelte         minimal: global CSS + <slot/>; SSR on (landing prerenders)
  +page.svelte           marketing landing → renders MarketingHero  (/)
  +page.ts               export const prerender = true
  (app)/                 route group (no URL segment) — the application
    +layout.server.ts    export const ssr = false            ← moved from root
    +layout.ts           supabase browser/server client      ← moved from root
    +layout.svelte       app boot, Turnstile, PwaPrompts      ← moved from root
    bills/+page.svelte           bill list (old (main) home)  → /bills
    bills/[billId]/...           one bill                     → /bills/[billId]
    auth/...                                                  → /auth
    invite/[billId]/...                                       → /invite/[billId]
  api/sync/+server.ts    unchanged (server endpoint, no layout)
  app.webmanifest/       unchanged
```

- **Landing** at `/` is prerendered + public; **app** lives at `/bills`, `/auth`,
  `/invite`. Both domains point at the same Worker.
- `app.cheqii.com/` redirects to `/bills` (the app home). The landing's CTAs
  ("Start a cheque" / "Sign in with Google") link to `app.cheqii.com`.
- Optional polish (later): host-canonicalization redirects (app paths hit on the
  root domain → app subdomain, and vice-versa) so each surface has one canonical host.

Why one app (vs two deploys): keeps one repo/deploy, shares the design tokens and
brand, and the landing reuses the same fonts/`light-dark()`. The cost is the routing
refactor below.

## Code changes (in this repo)

1. **Layouts:** make root `+layout.svelte` minimal; move the boot/ssr/supabase
   layout into `(app)/`. Root stays SSR-capable so the landing prerenders.
2. **Move app routes** into `(app)/`; relocate the home/bill-list from `(main)` → `/bills`.
3. **Landing route:** `+page.svelte` (MarketingHero) + `+page.ts` (`prerender = true`);
   `appUrl` points to the app subdomain (env-driven, default `https://app.cheqii.com`).
4. **Internal nav:** update `goto("/")` and `authRedirect` defaults `/` → `/bills`
   (AnonymousSignIn redirect, deleteBill/leaveBill, etc.). New-bill → `/bills/[id]`
   already works.
5. **Tests/E2E:** update the convergence E2E + any `/`-as-app-home assumptions.

## Infra you (owner) drive — not code

### Cloudflare

- Add **custom domains** to the Worker: `cheqii.com` (root) and `app.cheqii.com`
  (Workers → the `cheqii` worker → Domains & Routes). Keep `*.workers.dev` during
  cutover.
- After cutover: 301 `cheqii.myronng5.workers.dev` → `https://cheqii.com` (SEO).

### Supabase (Auth settings)

- **Site URL** → `https://app.cheqii.com`.
- **Redirect URLs** → add `https://app.cheqii.com/**` and `https://cheqii.com/**`
  (keep the `workers.dev` entry until cutover is done).

### Google Cloud Console (OAuth client)

- **Authorized JavaScript origins** → add `https://cheqii.com` and
  `https://app.cheqii.com` (needed for One Tap + the rendered button).
- Authorized redirect URI stays the Supabase callback (already set).

### Env / wrangler

- `PUBLIC_SUPABASE_URL` unchanged (same Supabase project). Landing `appUrl` →
  `https://app.cheqii.com`. Invite links already use `page.url.origin`, so they’ll
  emit `app.cheqii.com` automatically once served there.

## Sequencing (safe cutover)

1. Land the code refactor (landing at `/`, app at `/bills`) — deploy to the current
   `workers.dev` URL and verify everything still works there.
2. Add `cheqii.com` + `app.cheqii.com` custom domains; add the new URLs to Supabase
   redirect list + Google origins (additively, keeping workers.dev).
3. Verify on the real domains (sign-in, invite, sync).
4. Flip the landing `appUrl` / canonical to `cheqii.com`/`app.cheqii.com`; add the
   301 from workers.dev. Remove workers.dev from auth allow-lists once traffic moved.
