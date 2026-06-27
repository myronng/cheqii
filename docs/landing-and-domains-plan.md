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

## Design constraints — reuse the system, don't reinvent

The landing must feel native to the app, not a standalone page:

- **Tokens, not hardcoding.** Drop the local `--ck-*` block and all literal
  hex/px/timing in `MarketingHero`; use the app's semantic vars (`--color-action`,
  `--color-background`, `--color-background-raised`, `--color-text`,
  `--color-text-muted`, `--color-border`, `--color-surface`, `--space-*`,
  `--radius-card`, `--border-divider`, `--dur-*`, `--ease-standard`, fonts).
- **Extend the scale for hero sizes.** The headline is larger than the app's top
  step (`--text-2xl`). Add display steps to the shared type scale in `app.css`
  (e.g. `--text-3xl`, `--text-4xl` on the same ~1.2 ratio) and use those — still
  token-driven, no per-component magic numbers.
- **Localization.** All copy goes through the existing strings system
  (`localeStrings.json` + loaded strings), no inline English.
- **Component reuse.** Use `Logo` for the brand mark; match the app's pill-button
  styling via tokens for the CTAs.
- **One intentional exception:** keep the primary-CTA **glow** (`box-shadow`
  using `--color-action`).

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

## Infra split — what I (CLI) do vs owner

### I can do via CLI

- **Cloudflare custom domains** — `cheqii.com` + `app.cheqii.com` as `custom_domain`
  routes in `wrangler.jsonc`, provisioned on `wrangler deploy`. The `cheqii.com`
  zone is already in the CF account (confirmed), so DNS auto-provisions.
- **301 `…workers.dev` → `cheqii.com`** — in the Worker (host check in hooks/handler).
- **Env / wrangler** — `PUBLIC_SUPABASE_URL` unchanged; landing `appUrl` →
  `https://app.cheqii.com` (or env). Invite links use `page.url.origin`, so they
  emit `app.cheqii.com` automatically once served there.

### Owner-only (NOT safe via CLI)

- **Supabase Auth (dashboard):** Site URL → `https://app.cheqii.com`; Redirect URLs
  → add `https://app.cheqii.com/**` + `https://cheqii.com/**` (keep `workers.dev`
  until cutover). _Do not use `supabase config push`_ — `config.toml`'s `[auth]`
  holds local values (`site_url = http://127.0.0.1:3000`) and doesn't mirror the
  dashboard-set Google provider / Turnstile secret, so a push would clobber prod auth.
- **Google Cloud Console:** add `https://cheqii.com` + `https://app.cheqii.com` to
  Authorized JavaScript origins (One Tap + rendered button). Redirect URI unchanged.

## Sequencing (safe cutover)

1. Land the code refactor (landing at `/`, app at `/bills`) — deploy to the current
   `workers.dev` URL and verify everything still works there.
2. Add `cheqii.com` + `app.cheqii.com` custom domains; add the new URLs to Supabase
   redirect list + Google origins (additively, keeping workers.dev).
3. Verify on the real domains (sign-in, invite, sync).
4. Flip the landing `appUrl` / canonical to `cheqii.com`/`app.cheqii.com`; add the
   301 from workers.dev. Remove workers.dev from auth allow-lists once traffic moved.
