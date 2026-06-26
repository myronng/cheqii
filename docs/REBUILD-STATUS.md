# Rebuild Status & Session Handoff

Living status doc for the cheqii v2 rebuild. **A fresh Claude Code session can read this + the other `docs/` specs to pick up exactly where the last one left off** — the prior conversation transcript and Claude's local memory files do NOT transfer between machines, so this committed doc is the source of truth for "where we are."

_Last updated: 2026-06-26. **Phases 1–5 DONE** — the app runs end-to-end on v2 (live smoke test passed: create/edit bill → sync to Supabase). 0 type errors, 93 tests, prod build green. Remaining: Phase 6 hardening + the deferred UI/ops items below._

## What this is

Rebuilding cheqii (local-first collaborative bill-splitter) from scratch on branch `worktree-v2-rebuild`, guided by the specs in this `docs/` folder. Read in this order:

1. `implementation-plan.md` — the master plan: architectural principles (P1–P6), the resolved Phase-0 decision table, and the phased build order. **Start here.**
2. `data-model-spec.md`, `sync-engine-spec.md`, `auth-invite-spec.md`, `allocation-spec.md`, `frontend-architecture-spec.md`, `design-system-spec.md` — per-subsystem v2 designs.

## Stack (locked — see implementation-plan principles P1–P6)

Vite Plus + SvelteKit 5 (runes), Supabase (Postgres/RLS/Auth/Realtime), Cloudflare Workers, IndexedDB. Offline-first PWA. Native HTML+CSS first. DRY/shared contracts.

## Done

- **Phase 1 — schema + RLS** (commit `e52f3ba`). `supabase/migrations/20260625000001_v2_baseline_schema.sql` + `…000002_v2_rls.sql`. 8 tables, bigint money + tax/tip + per-bill currency, hlc/col_hlc/is_stub, invites, recursion-safe access fns with NO bypass + is_stub invisibility, RLS (30 policies), handle_new_user trigger. Validated vs `supabase/postgres:17`.
- **Phase 2 part 1 — sync RPCs + contracts + HLC** (commit `cf1eb0c`). `…000003_v2_sync_rpcs.sql` (15 idempotent `sync_*` RPCs: per-column LWW, is*stub healing, per-RPC authz, dedup ledger, `_upsert_split`/`\_ensure_stub*\*`helpers).`src/lib/sync/hlc.ts`(Hybrid Logical Clock).`src/lib/sync/mutations.ts`(canonical mutation types + Zod schemas, shared client+server). SQL validated vs`supabase/postgres:17` (dedup, out-of-order heal, per-column LWW, authz). TS modules authored but NOT yet runtime-tested.

## Local dev environment (validated 2026-06-25, same machine)

Deps + full local stack are now runnable and validated end-to-end:

- **Toolchain**: Vite+ (`vp`) is the unified CLI — `vp install`, `vp dev`, `vp check`, `vp test`, `vp exec <bin>`. Only `node`/`npm`/`vp` are on PATH (no global `pnpm`/`corepack`); `vp install` uses pnpm 10.32.1 under the hood.
- **`zod` was missing** from package.json though `src/lib/sync/mutations.ts` imports it — fixed (added zod 4.4.3, commit `91408fe`). After that, `vp exec svelte-check` is **0 errors** once `.env` exists + `svelte-kit sync` has run.
- **Env**: copy `.env.example` → `.env`. Local Supabase prints URL + publishable key; Turnstile uses CF's always-passes test key `1x00000000000000000000AA`; SERVER_KEY is a locally-generated Ed25519 DER-base64 pair (see `.env.example`). `.env` is gitignored. After editing `.env`, run `vp exec svelte-kit sync` to regenerate `$env/static/*` types.
- **Supabase local**: Docker here is **podman** emulating the Docker CLI. `supabase start` (via `vp exec supabase start`) applies all 3 migrations cleanly on `supabase/postgres`. Verified objects: 8 RLS-enabled tables (+`ordered_bill_splits` view), 15 `sync_*` RPCs, 30 RLS policies. If it says "already running" but a container "exited", run `vp exec supabase stop --no-backup` then start again (stale stack).
- **Run**: `vp dev` → http://localhost:5173/ serves the SPA shell (200); REST reachable with the publishable key.
- **Known pre-existing failures**: 12 component tests (`EntryPayments`/`EntrySettings`/`EntryGrid`) fail — inherited from the base refactor, NOT v2 work; they expect the old AppContext wiring and get rewired in Phase 5.

## How the SQL was validated (no Supabase CLI needed)

`docker`/`podman` is available with `public.ecr.aws/supabase/postgres:17.6.1.011` cached. Run a container, apply `supabase/migrations/2026*.sql` in order via `psql`, exercise the RPCs. (auth.users/auth.uid()/role `authenticated` already exist in that image.) See prior session for the exact harness; the pattern: `docker run -d … postgres:17`, wait for `pg_isready`, pipe each migration through `psql -v ON_ERROR_STOP=1`, then call `sync_*` functions with seeded `auth.users` rows.

## Phase 2 part 2 — runtime layer (DONE, commit `3c4e080`)

Client sync runtime + rewritten server endpoint, 33 unit tests passing, sync layer type/lint-clean:

- `src/lib/sync/uuid.ts` — sortable UUIDv7 for mutation ids.
- `src/lib/sync/clock.ts` — `HLCClock` wrapping pure `hlc.ts` (tick/receive/peek; injectable `now`).
- `src/lib/sync/mutation.ts` — `createMutation`: stamps UUIDv7 + HLC, Zod-validates payload before it can persist.
- `src/lib/sync/db.ts` — IndexedDB layer; migration list with **derived** `DB_VERSION`, stores `bills/users/outbox/cursors/meta`, atomic `commitMutation`, per-entity cursors + meta helpers. SSR-safe (`open()` → null off-browser).
- `src/lib/sync/engine.svelte.ts` — single-flight pump: push + **outbox-independent pull** in one round-trip, HLC-ordered batches, backoff+jitter, per-entity cursors, `$state` `isSyncing/pendingCount/isOnline`, rerun-coalescing.
- `src/lib/sync/liveness.ts` — Realtime(`mutation_logs`) + visibility/online + 30s heartbeat → `engine.pull()`; returns cleanup.
- `src/routes/api/sync/+server.ts` — v2 rewrite: per-mutation `parseMutation` (Zod), HLC-derived `p_created_at`, `rpcNameFor` dispatch, push-then-pull with **per-entity cursors** (`Record<entity_id, seq_id>`).

NOTE: `database.ts` was regenerated from the live v2 schema (committed copy was stale v1). This surfaces ~53 EXPECTED type errors in leftover v1 files (`bill.svelte.ts`, `user.svelte.ts`, `EntryGrid/EntrySettings`, `testMocks.ts`, and routes using `get_full_bill`/`join_bill_via_invite`) — all slated for Phase 3 (invite) / Phase 5 (frontend) rewrite. The prior "0 errors" was a false green from the stale types.

Test infra: added `fake-indexeddb` (dev) for real db-layer tests. The 12 pre-existing component-test failures are unchanged (not regressions).

### Still TODO in Phase 2

- **Live end-to-end validation** — wire engine to a real authed Supabase session and exercise acceptance scenarios 1–9 (the SQL side was already Docker-validated; the TS engine is unit-validated with mocks). Needs the frontend (Phase 5) to drive a real logged-in session.

## Phase 3 — auth & invite (backend core DONE)

- **`join_bill_via_invite` RPC** (commit `0849027`, `…000004_v2_join_invite.sql`) — capability-token redemption: SECURITY DEFINER, asserts caller = `auth.uid()`, validates exists/not-revoked/not-expired/under-`max_uses` (row-locked), adds membership at the invite's role, idempotent (repeat = no-op, higher role = upgrade, only new joins consume a use), `_bill_role_rank` prevents demoting an existing member. Validated 10/10 scenarios against local Supabase.
- **Anon→permanent via `linkIdentity`** (commit `5f0c297`) — `AccountButton` now links Google to the same `user_id` for anonymous users instead of `signInWithOAuth` (which orphaned anon work). `enable_manual_linking = true` in `config.toml` (confirmed live in gotrue).
- **Already in place from Phase 1/2** (verified, not rebuilt): role-aware access fns with no bypass + `is_stub` invisibility; sync RPCs enforce write access, owner-only role changes, and "link only your own account" (`sync_update_contributor` line 188–192); all SECURITY DEFINER fns have explicit `search_path` + authz-first.

## Phase 4 — allocation & settlement (DONE)

Pure, framework-agnostic domain libs under `src/lib/domain/`, 32 unit tests passing (0 type/lint errors):

- `money.ts` — `minorUnitDigits`/`scale` derived per ISO-4217 currency via Intl (USD/CAD 2, JPY 0, KWD 3), `format(amountMinor, currency, locale)`, `parse`. Only module that knows currency; everything else is integer minor units.
- `allocate.ts` — pure `allocate(contributors, items, {tax,tip})` → `Allocations`. **Largest-remainder (Hamilton)** per item fixes the v1 penny-drop bug (validated by the ratios-3:4-cost-10 case + a 200-seed property sweep asserting Σowing=Σpaid=grandTotal & 0 unaccounted). Splits matched by `contributor_id` (fixes v1 index bug). Proportional tax/tip via the same `largestRemainder` helper; `subtotal=0` falls back to equal split (remainder → unaccounted, per spec §2 edge).
- `settle.ts` — pure `settle(allocations)` → `{transfers, owingUnaccounted, paidUnaccounted}`. Deterministic two-pointer greedy (sort by amount desc then index asc), ≤ n−1 transfers, zeroes all balances (validated by 150-seed sweep). The v1 MaxHeap isn't used (no index tie-break → non-deterministic); min-transfers is an explicit non-goal.

NOTE: built fresh under `src/lib/domain/`; the v1 `src/lib/utils/common/{allocate,heap,formatter}.ts` remain until Phase 5 retires them.

---

## ⚠️ DEFERRED — MUST REVISIT

Tracked work intentionally skipped, to come back to before Phase 6 (hardening):

1. **Compaction (sync spec §8)** — NOT YET BUILT. `mutation_logs` grows unbounded without it; sync still converges, but cold-start replay and storage degrade over time. Needs: (a) a `SNAPSHOT` entry in `src/lib/sync/mutations.ts` contracts; (b) a `sync_snapshot` Postgres RPC that writes the full bill state stamped with the max HLC and truncates logs below that `seq_id`; (c) client apply of `SNAPSHOT` as wholesale state replacement (CREATE_BILL semantics); (d) a trigger policy — start with a nightly cron (alt: on-write threshold, e.g. >500 logs/bill). Deferred from Phase 2 because it's off the critical path and matters most once real data is flowing. **Revisit after Phase 3, or by Phase 6 at the latest.**

2. **Phase 3 tail — pieces that belong to infra or Phase 5/6:**
   - **Rate-limit `/api/sync`** (auth spec §3.4) — per-user / Cloudflare edge rate limiting + optionally a periodic fresh Turnstile token for anonymous principals. Belongs with Cloudflare infra (P2); not buildable/validatable headlessly here.
   - **Offline-user recovery** (auth spec §3.4, scenario 8) — detect the local-only fallback user (no real session), surface a "sign in to sync" prompt, replay the outbox under the real identity on reconnect. Client UX → **Phase 5**.
   - **Invite management UI** — owner create/revoke/regenerate of invite tokens (multiple live invites per bill). The table + redemption RPC exist; the UI → **Phase 5**.
   - **Live `linkIdentity` e2e** — the anon→Google upgrade redirect needs a real Google OAuth client; verify in manual/**Phase 6** testing (code + config are in place and type-checked).
   - **`get_full_bill`** — referenced by leftover v1 route `routes/api/bills/[billId]/+server.ts`; the v2 frontend loads bills via the sync engine, so that route is v1 dead code to retire in **Phase 5** (no v2 `get_full_bill` RPC is planned).

3. **Explicit tax/tip payer (allocation spec §2/§8 sub-decision)** — `allocate` currently apportions tax/tip's _paid_ side proportionally to item payments (one payer ⇒ covers all; multiple ⇒ split by what each fronted). The deferred option is to let a bill designate an explicit tax/tip **payer** (`contributor_id`). The proportional default is sufficient for v1; revisit only if the product wants a designated tax/tip payer.

4. **PWA install + update UX (frontend §3.6d′/c)** — the SW + persistent-storage + manifest groundwork is in place, but the _UI_ is not: contextual install promotion after the first bill (`beforeinstallprompt` on Chromium + iOS "Add to Home Screen" guidance), the in-app "new version available" reload prompt (client listener for the SW `SKIP_WAITING` + `registration.update()` poll), eviction re-hydration UX. **Install promotion is a stated v1 requirement** — Phase 5 polish or Phase 6.

5. **Landing SSR (frontend §3.5)** — prerender/SSR the public landing for SEO + first paint, but no separate public route exists yet (`(main)` is the authed, client-only bill list). Needs a dedicated marketing page first.

6. **Component interaction tests** — the v1-API `Entry*.svelte.test.ts` were deleted in 5.8 (they asserted the old AppContext wiring). Pure logic stays covered by the domain/sync/state suites (93 tests); rebuild component-level interaction tests against the v2 API (testing-library is installed).

7. **Tax/tip & currency editor UI** — `bills.tax`/`tip`/`currency` are first-class and `allocate` apportions tax/tip, but there's no editor control to set them yet (the grid only edits items; `createBill` defaults currency CAD). Add tax/tip + currency inputs to the settings/header UI.

## Phase 5 — frontend integration (DONE — runs end-to-end; UI-polish items deferred above)

The big integration phase: wire the sync engine (Phase 2), auth/invite (Phase 3), and allocation libs (Phase 4) into the SvelteKit UI; retire the leftover v1 files (~52 type errors + v1 `utils/common/{allocate,heap,formatter}`); absorb the deferred Phase-3 client UX. Broken into 8 sub-phases (tracked):

- **5.1 Design-system token foundation — DONE.** `app.css` promoted to primitive + semantic tiers with `light-dark()` + `color-scheme` (OS default, `[data-theme]` override), named space scale (`--space-0..6`), type scale (`--text-sm..2xl`), motion tokens (`--dur-*`, `--ease-standard`), tokenized glass surface. **Additive** — all v1 token names kept as legacy aliases so no component broke. `font-display: swap`; `<html dir="ltr">` baseline. The inline theme script + Logo are untouched. Validated: format/lint clean, served CSS resolves new tokens, dev server 200, no new type errors.
- **5.2 Base primitives — DONE** (commit `86ccbcc`). `base/ActionBar` (progression layout, primary inline-end, mirrors RTL), `base/Surface` (tokenized glass behind @supports), `base/Field` (label + native control + `:user-invalid`), `base/Popover` (Popover API + anchor positioning, UA-centered fallback); `Button` gains `variant="primary|secondary"` (primary = filled action). 0 type/lint issues.
- **5.3 Icon migration — DONE** (commit `8f338ed`). Phase-0 Option A: `unplugin-icons` + `@iconify-json/tabler`; all 19 wrappers → `~icons/tabler/<name>` (outline), tree-shaken (prod build 2.1s with full set installed). `Icon.svelte` wraps the unplugin component + applies the `variant` size/stroke class (global CSS in app.css); wrappers keep original paths so call sites unchanged. Mappings incl. Door→door-exit, SyncLock→lock-cog, Cancel→x, Delete→trash. **Note:** the chosen approach (wrap unplugin component in Icon.svelte, control class via wrapper, no plugin `defaultClass`). Tabler icons ship 1em/currentColor/stroke-2/round-caps already.
- **5.4 State layer rewrite — DONE (the keystone, built additively in `src/lib/state/`).**
  - **5.4a Convergence reducer** (commit `64ccbd6`). `model.ts` (v2 client snapshot types from generated Rows; splits kept **flat** with `allocationInput()` regrouping for the allocate lib) + `reduce.ts` (`applyBillMutation`/`applyUserMutation` — HLC per-column LWW mirroring the server RPCs, structural fill-once, stub healing, all 15 types). 9 tests.
  - **5.4b State classes + actions** (commit `e165e66`). `app.svelte.ts` — `AppState` owns HLCClock (node_id+last HLC in meta) / SyncDB / SyncEngine / UserState / BillState; single source of truth (`bills.byId`), discriminated `ensureLoaded → loading|ready|not_found|error`, `applyIncoming` reduces peer mutations, `watchAuth`. `actions.ts` — one DI style (`app` explicit): createMutation→reduce→atomic snapshot+outbox commit→enqueue→persist clock; all CRUD + create/delete/leave bill + `starterBill`. 4 write-path integration tests (fake-indexeddb). 0 type/lint errors. **Built additively — no v1 file touched yet**, so the ~52 v1 errors are unchanged (cleared in 5.5/5.8).
- **5.5 Layout wiring + component migration — IN PROGRESS.**
  - **DONE:** layout wired to `createAppContext`/`watchAuth` (`77029ad`); AppState sync construction + self-boot. **Auth + Main groups** (`083dabb`): `signInAnonymously` v2 (Turnstile→signin→invalidate, trigger creates the user row), `AnonymousSignIn`, `MainNewBillButton` (`createBill`+`starterBill`+`resolveIdentity`), `MainListing`, `(main)` page (single source of truth + cold-start `flattenServerBill` ingest) + server. **api/bills/:id** rewritten off `get_full_bill` (`5bd1fbc`); `ensureLoaded` flattens. All migrated files type+lint clean.
  - **DONE — entry editor group** (`9da1ddf`): `bills/[billId]/+page.svelte` (single source of truth `bills.byId`, discriminated `loading|ready|not_found|error`, per-bill currency, `allocate`/`settle` via `allocationInput`), `EntryGrid` (actions + flat-split lookup by `(item_id, contributor_id)`), `EntryPayments` (pure `settle()` instead of inline MaxHeap; `linked_user_id` linking; `updateBillUser`+`updateUser`), `EntrySettings` (visibility/role, flat-splits CSV), `EntrySummary`/`EntryHeader`/`EntryName`. `allocationInput` keeps all contributors so indices align.

- **5.8 Retire v1 dead code — DONE** (`9da1ddf`): deleted `utils/models/{bill,user,sync}.svelte` + `types.ts`, `utils/common/{context,indexedDb,allocate(+test),heap,testMocks}`, and the 3 v1-API component tests. **The whole tree now type-checks: 0 errors, 0 warnings; prod build green (2.0s); 90 tests pass.** `formatter.ts` kept (generic Intl helpers, not v1-coupled).

  **5.5 still TODO:** rebuild component interaction tests (deleted the v1-API ones; pure logic is covered by domain/sync/state suites) + a live end-to-end run (needs a logged-in session). The deferred Phase-3 client UX (offline recovery, invite-management UI) and the `regenerate invite link` button (removed — invites table has no bill `invite_id`) remain for the invite-management work.

- **5.6 Runtime i18n — DONE** (`3ed97fb`). `LOCALE_DIRECTION` map + `pluralize()` (Intl.PluralRules); `<html lang/dir>` resolved from the locale cookie via a `transformPageChunk` hook (`%lang%`/`%dir%` in app.html — verified serving `lang="en-CA" dir="ltr"`); **missing-string CI guard** test (fails if any shipped locale key is empty). Currency-from-bill-data already landed in 5.5.
- **5.7 PWA durability — core DONE** (`3ed97fb`). Service worker rewritten to fix the v1 over-broad cache: **never caches `/api/*` or cross-origin Supabase**, cache-first only for immutable build assets, network-first + app-shell fallback for navigations, `skipWaiting`/`clients.claim` + `SKIP_WAITING`. `navigator.storage.persist()` on boot. Manifest/app.html completeness: `viewport-fit=cover`, theme-color per scheme, apple-touch-icon + apple meta, manifest `categories`. **Deferred (UI-heavy / needs a public route):** contextual install promotion (`beforeinstallprompt` + iOS A2HS), in-app update-available prompt, eviction re-hydration UX, and landing SSR (no separate marketing route exists). Tracked below.
- **5.8 Retire v1 dead code** — clears the ~52 v1 type errors. Do last, after components migrate. NOT STARTED.

## After Phase 5

**Phase 6 (hardening)** — rate-limiting, live linkIdentity/OAuth e2e, as-`authenticated`-role JWT RLS integration test (still unverified), compaction if not done earlier.

Phases 1–4 (schema/RLS, sync, auth backend, allocation) built and validated; Phase 5 in progress (5.1 done).

## Resuming on another machine

1. `git fetch && git checkout worktree-v2-rebuild` (or recreate a worktree on it).
2. Open a fresh Claude Code session in the repo and point it at `docs/implementation-plan.md` + this file.
3. Continue from "Next up" above.
