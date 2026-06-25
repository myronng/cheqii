# Frontend Architecture Spec (v2)

The app shell everything else plugs into: the SvelteKit setup, the reactive `AppState` context, routing, component structure, the PWA/offline layer, and localization. This redesign keeps the local-first SPA model and the runes-in-classes state pattern, but removes the dual-source-of-truth friction and makes locale/currency/user first-class context instead of drilled props.

## Goals

- **Single reactive source of truth** per entity — no copied-and-reconciled state.
- **Offline-first** rendering and writes, with honest loading/error states (no infinite spinners).
- **Context over prop-drilling** for cross-cutting concerns (user, locale, currency, app state).
- **Deterministic boot** — clear sequence from page load → identity → local data → render.
- **Runtime i18n + currency**, decoupled from a single hard-coded locale.

---

## 1. v1 architecture (as built)

### Stack & rendering

- SvelteKit + **Svelte 5 runes**, `@sveltejs/adapter-cloudflare`. `ssr = false` globally → the app is a **client-rendered SPA**. (The service worker comment notes SvelteKit lacks a clean offline-first story with SSR on.)
- `+layout.server.ts` forwards cookies and sets `ssr = false`. `+layout.ts` (`depends("supabase:auth")`) creates a browser or server Supabase client and reads the session.

### The reactive hub — `AppState` (`context.svelte.ts`)

- `+layout.svelte` calls `setAppContext()`, constructing one `AppState` and putting it in Svelte context (`getAppContext()`).
- `AppState` owns three runes-based state machines (each a class in a `.svelte.ts` file using `$state`/`$effect`/`$derived`):
  - **`UserState`** — current user `UserData`, IndexedDB-backed, falls back to `last_user_id` metadata.
  - **`BillState`** — loaded bills, keyed off `user.data.bills`.
  - **`SyncState`** — outbox pump (see sync spec).
- `AppState` watches Supabase auth via `onAuthStateChange` and exposes `applyIncomingMutation` (the client-side replay of remote mutations). `initialized = user.initialized && bills.initialized`.
- `idb` is a **module-level `await`** singleton — the app blocks on IndexedDB open at import time.

### Layout responsibilities

- Renders the **Turnstile container** + loads the Turnstile script when there's no session.
- Signs out "invalid" users (session present but `getUser()` fails).
- Re-invalidates `supabase:auth` when the session's `expires_at` changes.
- Gates the whole tree on `app.initialized`, showing a `Loader` until ready.

### Routing

| Route                            | Role                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `(main)/+page`                   | Bill list / landing (`MainListing`, `MainEmptyList`, `MainNewBillButton`, hero/CTA) |
| `bills/[billId]/+page`           | The bill editor (grid + payments + summary + settings)                              |
| `auth/+page`                     | Auto anonymous sign-in + redirect                                                   |
| `invite/[inviteId]/[billId]`     | Join via invite (server load → RPC → redirect)                                      |
| `api/sync`, `api/bills/[billId]` | Sync endpoint + single-bill fetch                                                   |
| `app.webmanifest`, `+error`      | PWA manifest, error page                                                            |

### The bill page reactivity (the friction point)

- Keeps a **local `billData = $state(...)` copy** and reconciles it against the global `bills.data` store with an `$effect` that compares `updated_at` **strings** (`fromStore.updated_at > billData.updated_at`).
- `bind:billData` two-way-binds the local copy into `EntryHeader/Grid/Payments/Settings`; mutation helpers (`addItem`, etc.) mutate both the bound object and the store via `bills.apply()`.
- `allocations` is `$derived` from `billData`. Currency uses a module-level `CURRENCY_FORMATTER` (en-CA/CAD).

### Components

- `entry/*` — the editable grid (rows = items, columns = contributors), payments/settlement, per-contributor summary dialog, settings (invite/visibility/delete/export).
- `main/*`, `auth/*`, `base/*` (`Button`, `ButtonLink`, `Dialog` over native `<dialog>`, `Input`, `Loader`, `Logo`), `icons/*`.
- Cross-cutting values (`strings`, `currencyFormatter`, `userId`) are **drilled as props** through many layers.

### Localization

- Build-time `localeStrings.json` flattened into `LOCALE_MASTER`. Server picks locale from a `locale` cookie or `accept-language`. Pages request a **subset** of keys via `getLocaleStrings(...)`. `interpolateString` does `{placeholder}` substitution; missing keys render `@key@`.
- **Only `en-CA`** is wired; CAD/2-decimals assumed.

### PWA / offline

- Service worker precaches `build` + `files`; **network-first with cache fallback** for everything else. Ignores non-GET (the outbox handles offline writes). Cache name keyed on deploy `version`.

---

## 2. Sharp edges in v1 (must address)

1. **Dual source of truth on the bill page.** A local `$state` copy _and_ the global store both hold the bill, reconciled by a string `updated_at` comparison. Mutations write to both. This is fragile, easy to desync, and will break under HLC ordering (string compare ≠ HLC compare).
2. **Infinite spinner on load failure.** `ensureLoaded` returning `undefined` leaves `billData = null`; the template's `{#if billData && allocations}` falls through to `Loader` **forever** — no error state, even though `loading` was set false.
3. **Prop-drilling cross-cutting state.** `strings`, `currencyFormatter`, `userId` thread through every component instead of living in context.
4. **Inconsistent dependency injection.** Some mutation helpers take `app` as a param (`addItem(app, …)`); others call `getAppContext()` internally (`updateUser`, `deleteBillUser`). Pick one.
5. **Single hard-coded locale + currency.** i18n is build-time `en-CA` only; currency is a module-level CAD formatter. Blocks the allocation spec's multi-currency goal.
6. **No SSR at all.** Fine for the app, but the landing/marketing route loses SEO and first-paint speed.
7. **Module-level `await` on IndexedDB.** Couples app import to IDB availability; in environments without IndexedDB the singleton is `null` and every call is silently a no-op (`idb?.`), which can mask bugs.

---

## 3. v2 design

### 3.1 Single source of truth

- The bill page reads the bill **directly from the store** as `$derived(() => bills.byId(id))` — no local `$state` copy, no `updated_at` reconciliation effect. Child components receive the store-owned object; edits go through mutation helpers that update the store (and IDB + outbox) in one place.
- Conflict/merge ordering uses **HLC** (sync spec), never string `updated_at` comparison.

### 3.2 Honest async states

- Model bill loading as a discriminated state: `loading | ready | not_found | error`. The template renders a spinner, the editor, a redirect, or an error panel respectively — **never** an unbounded spinner.
- Centralize fetch-failure handling (403/404 → purge + redirect; network → retry/offline banner) in `ensureLoaded`, surfaced as typed results.

### 3.3 Context for cross-cutting concerns

- Provide `user`, `locale`/`strings`, and `currency`/`formatter` via context (alongside the existing `AppState`). Components pull what they need; stop drilling. Keep explicit props only for genuinely local inputs.
- Standardize on **one DI style**: all mutation helpers take `app` explicitly (testable) — drop the internal `getAppContext()` calls.

### 3.4 Runtime i18n + currency

- Locale resolved at runtime (cookie/header/user preference), strings loaded per-locale (lazy-import locale chunks, not one build-time blob, once >1 locale exists).
- Currency formatter derived from the **bill's `currency`** (data-model spec), not a module constant. `getNumericDisplay`/`parseNumericFormat` take the per-bill formatter.

### 3.5 Rendering strategy

- Keep `ssr = false` for the authenticated app (local-first, no hydration mismatch with IndexedDB).
- **Opt the public landing route into prerender/SSR** for SEO + fast first paint. This is the one place SSR earns its keep.

### 3.6 PWA & offline durability

Keep precache + the offline indicator + the "new version available" prompt. But a **local-first** PWA whose source of truth is IndexedDB has obligations a normal web app doesn't — losing local storage means losing unsynced user data. The considerations below are ordered by how much they can hurt this specific app.

**(a) Storage durability — the critical one.** The outbox can hold mutations that exist _only_ on the device until sync. If the browser evicts storage, that data is gone.

- Request **persistent storage** (`navigator.storage.persist()`) at a sensible moment (after first meaningful write / on install). Persisted origins are exempt from eviction-under-pressure.
- **iOS/Safari evicts script-writable storage (IndexedDB included) after ~7 days of no use** for _non-installed_ PWAs. This is an existential risk for a local-first app. Mitigations: encourage **install** (installed PWAs are exempt), keep sync prompt and fast flush so unsynced data doesn't linger, and treat the **server as the recoverable source** — on cold start with a valid session, re-hydrate from Supabase rather than assuming IDB survived.
- Surface storage health: `navigator.storage.estimate()` for quota; handle `QuotaExceededError` gracefully (don't silently drop mutations).
- Detect eviction/data-loss on boot (expected user/bills missing but session valid) → re-sync instead of showing an empty app.

**(b) Service-worker caching scope (fix v1's over-broad cache).** v1's SW caches _every_ successful GET. It must not cache dynamic/authoritative responses.

- **Never cache** `/api/*` or cross-origin **Supabase REST/Auth/Realtime** responses (staleness + leaking authed data into the cache). Network-only for those.
- **Cache-first** for hashed immutable build assets; **precache** the app shell.
- **Navigation fallback:** serve the cached app shell for navigations when offline (app-shell pattern) so deep links work offline — natural fit with `ssr=false`.

**(c) Update lifecycle, coordinated with IDB migrations.**

- Deploy-versioned cache (kept). Poll `registration.update()` and show the update prompt; apply via a `SKIP_WAITING` message + `clients.claim()` so the user controls the reload.
- A new SW may ship a new **IndexedDB schema version** (sync spec migrations). Sequence it: activate SW → run IDB migration → then resume sync, so a half-migrated DB never syncs.

**(d) Installability / manifest completeness.**

- Manifest: `name`, `short_name`, `id`, `start_url`, `scope`, `display: standalone`, `theme_color`/`background_color` (from design tokens, light+dark), `categories`, `screenshots` (richer install UI), and icons incl. **512px + maskable** (Android adaptive).
- **iOS doesn't fully honor the manifest:** add `apple-touch-icon` and `apple-mobile-web-app-*` meta + (optionally) splash screens.

**(d′) Install promotion — a v1 REQUIREMENT.** Because installing is the primary defense against iOS storage eviction (§a), actively driving installation is in scope for v1, not a later nicety. Design:

- **Trigger contextually, not on arrival:** surface the prompt **after the first bill is created** — the moment the user has proven value _and_ the moment device-only unsynced data starts to exist. Optionally re-surface when unsynced data exists on a non-installed device.
- **Android/Chromium:** capture `beforeinstallprompt` (preventDefault, stash the event), render a custom in-app install affordance, and call `prompt()` on user action.
- **iOS/Safari:** no `beforeinstallprompt` — show a concise **"Add to Home Screen"** instruction sheet (Share → Add to Home Screen), since it's the only path and the eviction risk is highest there.
- **Pair with persistence:** on install (or first write) call `navigator.storage.persist()`.
- **Respect the user:** detect already-installed (`matchMedia('(display-mode: standalone)')` / iOS `navigator.standalone`) and suppress; make the prompt dismissible and remember dismissal; don't nag (show once, re-surface only on the unsynced-data condition).
- **Honesty:** frame the value plainly ("install to keep your bills on this device and work offline"), not a dark-pattern interstitial.

**(e) Standalone display polish.** `viewport-fit=cover` + `env(safe-area-inset-*)` for notch/home-indicator; `theme-color` via `prefers-color-scheme` so the status bar matches the active theme.

**(f) Offline-action UX (what can't be local).** Most actions are local (P5), but a few genuinely need the network and must degrade honestly, not hang: **Google sign-in**, **anonymous sign-up (Turnstile)**, and **joining an invite** all require a server round-trip. Detect offline and show a clear "needs connection" state rather than a dead button. (Creating/editing bills anonymously works fully offline.)

**(g) Optional, support-gated enhancements.**

- **Background Sync API** (`SyncManager`) to flush the outbox after the app is closed — but it's unsupported on Safari/iOS, so it's an enhancement layered over the existing foreground retry loop, never the primary mechanism.
- **Web Push** for "someone updated your bill" — only on **installed** PWAs (iOS 16.4+), needs VAPID + a push handler in the SW + a permission UX. Likely post-v1; note it as a future tie-in with the sync engine's incoming-mutation feed.

---

## 4. Native-first UI — decision ladder & component inventory

> Realizes principle **P4** (rule of least power) from the implementation plan. The goal is to reach for the **lowest-power tool that actually exists** for a given job — not to avoid JavaScript. This app is `ssr=false` and offline-first (**P5**), so JS is a first-class, required tool: reactivity, IndexedDB, sync, `Intl` formatting, clipboard, and form submission all run client-side. The ladder is about _preference order when an equivalent exists_, not abstinence.

### 4.1 The decision ladder

For any UI capability, choose the **first** rung that can do the job; drop to the next only when the one above genuinely can't (or its support is inadequate):

1. **Semantic HTML element** — `<dialog>`, `<details>`/`<summary>`, `<form>`, `<select>`, `<input>` (with `type`/`inputmode`/`min`/`max`/`step`/`pattern`/`required`), `<progress>`, `<a download>`, `<button>`.
2. **CSS-only** — layout (grid/subgrid, flex, `position: sticky`), theming (`prefers-color-scheme`, `light-dark()`, `accent-color`), state (`:has()`, `:user-invalid`, `:popover-open`), `@container` queries, scroll-driven and `@view-transition` animation, CSS anchor positioning.
3. **Native browser API** — Popover API, Web Share API, Constraint Validation API, Clipboard API, View Transitions API, `IntersectionObserver`.
4. **Minimal JS via Svelte** — runes for reactivity, event handlers, IDB/sync glue. Expected and fine.
5. **Bespoke component** — last resort, only when rungs 1–4 can't deliver. **Document the "why native didn't work" at the call site.**

### 4.2 Component inventory (UI concern → native-first approach)

| UI concern (v1 component)                                                                   | Native-first approach                                                                                                | JS needed?                    | Notes                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modal: summary, settings, delete-confirm (`Dialog.svelte`, `EntrySummary`, `EntrySettings`) | **`<dialog>`** + `showModal()`                                                                                       | thin (open/close)             | Native focus-trap, `Esc`, `::backdrop`, top-layer. v1 already does this — keep as the shared primitive.                                                                |
| Confirm / destructive prompts                                                               | **`<dialog>`** with `<form method="dialog">`                                                                         | thin                          | Never `window.confirm` (unstyleable, blocks). `returnValue` gives the choice.                                                                                          |
| Menus / account dropdown / overflow (`AccountButton`)                                       | **Popover API** (`popover` + `popovertarget`) + **CSS anchor positioning**                                           | none–thin                     | Light-dismiss + top-layer for free; no bespoke click-outside/focus logic.                                                                                              |
| Tooltips / hints                                                                            | `popover="hint"` or `title`                                                                                          | none                          |                                                                                                                                                                        |
| Disclosure / collapsible sections                                                           | **`<details>`/`<summary>`**                                                                                          | none                          |                                                                                                                                                                        |
| Text & numeric entry: item name, cost, payment id (`EntryInput`, `Input`)                   | **`<input>`** with `inputmode`, `enterkeyhint`, `min`/`max`/`step`, `pattern`, `required`                            | formatting only               | Pair with `Intl` parse/format (JS, no HTML equivalent).                                                                                                                |
| Dropdown choice: payment method, contributor (`EntrySelect`)                                | **native `<select>`**                                                                                                | none                          | Only go custom if multi-select-with-search becomes a real need.                                                                                                        |
| Forms: bill settings, payment account (`EntrySettings`, `EntryPayments`)                    | **`<form>` + Constraint Validation** (`required`, `:user-invalid`, `setCustomValidity`, `checkValidity()`)           | **yes — submit handler**      | `ssr=false` + offline-first ⇒ submit is `e.preventDefault()` → local mutation, **never a network POST**. We still get native validation UI and accessibility for free. |
| Toggle: invite-required / visibility (`ToggleButton`)                                       | **`<input type="checkbox">`** styled, or `<select>` for 3-state visibility; `button[aria-pressed]` if it's an action | none–thin                     |                                                                                                                                                                        |
| Share invite link (`EntryShare`)                                                            | **Web Share API** (`navigator.share`) → fallback to clipboard                                                        | yes                           | No HTML equivalent; rung-3 API.                                                                                                                                        |
| Copy to clipboard (payment id, link)                                                        | `navigator.clipboard.writeText` on a `<button>`                                                                      | yes                           | Bespoke-justified: no native element.                                                                                                                                  |
| CSV export / download                                                                       | **`<a download>`** + blob URL                                                                                        | builds the blob               | Prefer a real anchor over a synthetic `click()`.                                                                                                                       |
| Loading indicator (`Loader`)                                                                | **CSS-only** animation; `<progress>` when determinate                                                                | none                          |                                                                                                                                                                        |
| Grid (items × contributors) (`EntryGrid`)                                                   | **CSS grid + subgrid**                                                                                               | none                          | v1 already uses subgrid — keep.                                                                                                                                        |
| Sticky payments panel                                                                       | **CSS `position: sticky`**                                                                                           | none                          |                                                                                                                                                                        |
| Page/route transitions                                                                      | **View Transitions API** / `@view-transition`                                                                        | none–thin                     | Progressive: no-ops where unsupported.                                                                                                                                 |
| Theme (light/dark)                                                                          | **`prefers-color-scheme`** + `light-dark()` + `data-theme` override                                                  | thin (toggle persists choice) |                                                                                                                                                                        |
| Icons (`icons/*`)                                                                           | inline **SVG**                                                                                                       | none                          |                                                                                                                                                                        |
| Number format/parse (`formatter.ts`)                                                        | **`Intl.NumberFormat`**                                                                                              | yes                           | Platform API; reused via the shared `lib/money` module (P6).                                                                                                           |
| Routing                                                                                     | SvelteKit                                                                                                            | yes                           | Framework-owned.                                                                                                                                                       |

### 4.3 Consequences

- The shared `base/*` primitives shrink: `Dialog` wraps `<dialog>`, a new `Popover` wraps the Popover API, `Input`/`Select` are thin styled wrappers over native elements exposing constraint-validation props. No bespoke modal/menu/focus-trap code to own.
- **Forms are JS-submitted but HTML-validated:** because the app is JS-required by design, progressive-enhancement-to-no-JS is a non-goal for the authenticated app (the public landing route remains prerendered — §3.5). We still use native `<form>` + Constraint Validation for accessibility, semantics, and free validation UI; the _submit_ is intercepted to write locally.
- Every bespoke widget that survives rungs 1–4 must carry a one-line comment justifying why native couldn't serve it — this keeps the exceptions honest and reviewable.

---

## 5. Boot sequence (v2, explicit)

```
1. Load app shell (SPA).                          [+layout.ts: supabase client + session]
2. setAppContext() → AppState constructs UserState/BillState/SyncState.
3. Resolve identity:
     session?  → userId = session.user.id
     no session on a protected route → set authRedirect cookie, go /auth (auto anon sign-in)
4. UserState hydrates from IDB (or last_user_id); BillState loads user's bills from IDB.
5. SyncState flushes outbox + pulls (sync spec liveness sources).
6. app.initialized (user + bills ready) → render route; until then, Loader.
7. Route load:
     (main)   → list bills from store
     bills/id → bills.ensureLoaded(id) → {loading|ready|not_found|error} → render
```

---

## 6. Acceptance scenarios

1. **No stale bill view:** an incoming remote mutation updates the bill on screen without a manual local-copy reconciliation, ordered by HLC.
2. **Load failure shows an error, not a spinner:** a 500 from `/api/bills/:id` renders an error panel with retry; a 403/404 purges locally and redirects home.
3. **Offline edit round-trips:** edit while offline → UI updates instantly, outbox grows, banner shows "offline"; on reconnect it flushes and the banner clears.
4. **Locale switch:** changing locale re-renders all strings without a full reload; missing keys are caught in CI (no `@key@` in shipped strings).
5. **Per-bill currency:** a JPY bill renders 0-decimal amounts; a CAD bill renders 2-decimal — driven by bill data, not a constant.
6. **New deploy prompt:** after a deploy, an open client is offered to reload to the new version.
7. **Landing SEO:** the public landing route is server-rendered/prerendered and indexable.
8. **Native-first holds:** modals are `<dialog>`, menus are Popover-API, choices are `<select>`, forms use Constraint Validation — no hand-rolled focus-trap / click-outside / modal code. Any bespoke widget carries a comment justifying why native couldn't serve it (§4 ladder).
9. **Storage durability:** persistent storage is requested; on a cold start where IDB was evicted but the session is valid, the app re-hydrates from Supabase instead of showing an empty state — no unsynced-data-shaped hole presented as truth.
10. **Cache scope is correct:** `/api/*` and Supabase responses are never served from the SW cache; an offline deep-link still resolves via the app-shell navigation fallback.
11. **Install promotion (v1):** after the first bill is created, a non-installed user is offered install — native prompt on Chromium, A2HS guidance on iOS; persistence is requested; the prompt is suppressed when already installed and not re-shown after dismissal except under the unsynced-data condition.

---

## 7. Open decisions

- **State container shape** — keep the hand-rolled runes-in-classes `AppState` (works well, zero deps) vs. adopt a store library. Recommendation: keep it; just remove the dual-source pattern.
- **i18n library** — stay with the JSON + `interpolateString` approach (tiny, typed) vs. a framework (Paraglide/inlang) once locales multiply.
- **SSR scope** — landing only, or also read-only public bill views (shareable previews)?
- **Component context granularity** — one big context vs. separate locale/currency/user contexts.
