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
- **Cloudflare Turnstile (dashboard):** add `app.cheqii.com` + `cheqii.com` to the
  widget's **Hostnames** (site key `0x4AAAAAAA-OJitqXFjVpwPg`). Real keys enforce the
  hostname list; without the new domains, anonymous "New Bill" fails with Turnstile
  error `110200` (domain not allowed) — the token never issues, so sign-in stalls.
  Not wrangler-managed; dashboard/API only.

## Sequencing (safe cutover)

1. Land the code refactor (landing at `/`, app at `/bills`) — deploy to the current
   `workers.dev` URL and verify everything still works there.
2. Add `cheqii.com` + `app.cheqii.com` custom domains; add the new URLs to Supabase
   redirect list + Google origins (additively, keeping workers.dev).
3. Verify on the real domains (sign-in, invite, sync).
4. Flip the landing `appUrl` / canonical to `cheqii.com`/`app.cheqii.com`; add the
   301 from workers.dev. Remove workers.dev from auth allow-lists once traffic moved.

## Implementation status (done)

- **Code restructure (`b9218fc`):** landing at `/`; app under `(app)/` at `/bills`,
  `/bills/[id]`, `/auth`, `/invite`; minimal root layout; `/`→`/bills` nav fixes.
  `MarketingHero` reworked to the app's tokens + `Logo` + localized copy (CTA glow
  kept); type scale extended (`--text-3xl/4xl/5xl`).
- **Custom domains (`a1030d3`):** `cheqii.com` + `app.cheqii.com` provisioned via
  `wrangler.jsonc` routes (`custom_domain`).
- **Owner config (done by owner):** Supabase Site URL `https://cheqii.com` +
  redirect URLs (exact **and** `/**` for both domains); Google Authorized JS origins
  for both domains. (Note: the app's OAuth `redirectTo` is the bare origin, so the
  exact no-slash entry is the one that matches; `/**` covers path redirects.)
- **Cutover:**
  - **Landing is SSR, not prerendered.** A prerendered static `/` would be served
    before `hooks.server.ts`, so host redirects (e.g. `app.cheqii.com/ → /bills`)
    couldn't run. SSR keeps it crawlable + fast and lets `handle` run on every
    request. (If max edge-caching is wanted later: prerender + Cloudflare Redirect
    Rules at the edge instead.)
  - **Host canonicalization (`hooks.server.ts`):** marketing on `cheqii.com`, app on
    `app.cheqii.com`; `301`s — `cheqii.com` + app-path → `app.cheqii.com`;
    `app.cheqii.com/` → `/bills`; `*.workers.dev` → the matching canonical host
    (search preserved, so the OAuth `?code` survives). `/api/*` + `/app.webmanifest`
    are **excluded** so same-origin POSTs (`/api/sync`) and the manifest aren't redirected.
  - `wrangler.jsonc` `workers_dev: true` re-added (defining `routes` disables it by
    default) so the legacy URL stays live and 301s instead of 404ing.
  - Landing CTAs point at `https://app.cheqii.com`.
  - **Verified live:** `cheqii.com/` landing 200; `cheqii.com/bills` 301→app;
    `app.cheqii.com/` 301→`/bills`; `app.cheqii.com/bills` 200; `workers.dev/*` 301→
    canonical; `/api/sync` 401 (not redirected).
- **Header auth UX (push login, stay guest-usable):** only a PERMANENT (Google) user
  is treated as signed in (shows avatar/initial). A guest (anonymous) or signed-out
  visitor sees an explicit "Sign in with Google" affordance, so login is always
  visible but never required:
  - **Signed out** → `GoogleSignIn` (One Tap + GIS button, `signInWithIdToken` — safe,
    no data to orphan).
  - **Anonymous (guest)** → `AccountButton` renders a "Sign in with Google" button that
    calls `linkIdentity` (same `user_id`, so bills carry over). **Never** One Tap/
    id-token for a guest (that mints a new user and orphans their bills).
  - **Permanent** → `AccountButton` shows the avatar / name initial.
  - Header strings (`signInWithGoogle`, `account`) added to the `/bills` list and
    `/bills/[id]` loaders (else the button renders empty).
- **Remaining:** in-browser end-to-end auth check on `app.cheqii.com` (real Google);
  later, drop `workers.dev` from the Supabase/Google allow-lists once traffic moved.

## Landing copy + CTA changes (done)

Five home-page (landing) tweaks:

- **Header + secondary CTA → "Go To App".** Both the nav-link (was "Sign in") and
  the secondary hero CTA (was "Sign in with Google") are now plain links labelled
  `goToApp` ("Go To App") pointing at `appUrl` (`https://app.cheqii.com`). No
  in-page auth from the landing — it just sends people into the app.
- **Title-case CTA.** `startACheque` → "Start A Cheque" (also updates the step
  card, which reuses the same string).
- **"Start A Cheque" auto-creates a bill.** The primary CTA points at `${appUrl}/new`
  instead of the app root. The new `(app)/new` route runs a shared
  `createNewBill(app, supabase, strings)` helper (extracted from `MainNewBillButton`
  into `state/actions.ts`): it uses the signed-in user if present, else signs in
  anonymously (invisible Turnstile), builds a localized starter bill, and redirects
  to `/bills/[id]`. `MainNewBillButton` now calls the same helper (single source of
  truth). `/new` added to the `hooks.server.ts` `isAppPath` list so
  `cheqii.com/new` → `app.cheqii.com/new`. The `/new` page shows a localized
  "Starting your cheque…" splash (Logo + `startingYourCheque`) while it works.
- **Headline period removed.** `landingHeadline`: "Settle up in the fewest payments."
  → "…payments" (no trailing period).
- **Subtitle em dash → two sentences.** `landingSubtitle`: "…smallest set of
  payments — exact to the last cent." → "…smallest set of payments. Exact to the
  last cent."

Verified locally (Playwright on the dev server): `/new` → anonymous sign-in →
redirect to `/bills/[id]`; starter grid renders; editing item cost updates the
total. Landing HTML confirms the new copy, two "Go To App" links → `app.cheqii.com`,
and the primary CTA → `app.cheqii.com/new`. All 87 unit tests + `vp check` green.

### Product-mock polish + CTA-card tweaks (done, deployed)

- Removed the "{count} people · live" blurb + pulse indicator (string, markup, CSS);
  the mock title centers against the avatar row. Dropped the card drop-shadow
  (the app uses no shadows; the radial brand glow stays).
- Title-cased "Tofino Weekend"; "Cabin · 2 nights" → "Cabin" at 600.00.
- Reworked the demo numbers so they settle exactly: all items split 4 ways
  (600/240/120, shares of 240) → Maya +360, Sam even, Jordan −120, Ana −240 →
  2 payments to Maya (120 + 240), matching the count.
- Step cards: title-cased headings via CSS `text-transform: capitalize` (the shared
  settle-up / add-items strings stay sentence-case in the app). First card →
  "No account needed. Try it for free." "2 payments" is now plain monospace text
  in `--color-action` (no pill badge).

Deployed to `cheqii.com` / `app.cheqii.com` and verified live (copy, CTA hrefs,
`/new` 200, `cheqii.com/new` 301 → `app.cheqii.com/new`).
