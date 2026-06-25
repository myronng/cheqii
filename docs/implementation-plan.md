# Master Implementation Plan

Build order for the new app, derived from the five subsystem specs. Read those first — this document only sequences them and resolves the decisions that must be settled before code.

- [`data-model-spec.md`](./data-model-spec.md) — schema, RLS, the convergence point
- [`sync-engine-spec.md`](./sync-engine-spec.md) — local-first mutation sync
- [`auth-invite-spec.md`](./auth-invite-spec.md) — identity, roles, sharing
- [`allocation-spec.md`](./allocation-spec.md) — split math + settlement
- [`frontend-architecture-spec.md`](./frontend-architecture-spec.md) — app shell
- [`design-system-spec.md`](./design-system-spec.md) — tokens, theming, icons, bidi layout

## What the app is

A local-first, offline-capable, multi-device collaborative **bill-splitting PWA**. Stack (confirmed from v1, kept): SvelteKit 5 (runes) + Supabase (Postgres/Auth) + Cloudflare (Workers/Pages) + IndexedDB, client-rendered SPA (`ssr=false`) with a precaching service worker.

---

## Architectural principles (non-negotiable constraints)

These are deliberate, standing decisions. They constrain every phase below; when a phase choice conflicts with one of these, the principle wins. They exist to keep the system explicit, native, and cheap to reason about.

### P1 — Stack: Vite Plus + SvelteKit, not React

Build on **Vite Plus + SvelteKit 5 (runes)**. This is a deliberate choice _against_ React-style frameworks. Svelte's reactivity is explicit and compile-time: `$state`/`$derived`/`$effect` make data flow legible, and there's no `useEffect`-class footgun (stale closures, dependency-array bugs, render-loop re-entrancy). We are **not** betting on the React Compiler to paper over those traps — auto-memoization is too implicit to trust as a correctness mechanism. Reactivity must be something a reader can trace, not something a compiler hides.

- _Implication:_ prefer `$derived` over `$effect`. Reserve `$effect` for genuine side effects (DOM, subscriptions, IDB) — never to compute state that a `$derived` could own. This directly retires the v1 bill-page "duplicate `$state` + reconcile" pattern (frontend spec §3.1).

### P2 — Cloudflare is the primary infrastructure

**Cloudflare is the home base for compute, hosting, and edge concerns.** The app and all SvelteKit server endpoints run on **Cloudflare Workers** (`adapter-cloudflare`); static assets + the PWA shell ship from Cloudflare's edge/CDN. Lean on Cloudflare-native primitives before reaching elsewhere: **Turnstile** for bot defense (already in use), Workers for the `/api/*` surface, and edge-level **rate limiting** for the sync endpoint (auth spec §3.4). Consider Cloudflare KV/Durable Objects only if a concrete need appears that Supabase can't serve — default is _don't_, to avoid a second source of truth.

### P3 — Supabase is the online backend

**Supabase remains the system of record for online state, realtime, and auth** — Postgres + RLS (data-model spec), Realtime for sync liveness (sync spec §4), and Auth (anonymous + Google, auth spec). Cloudflare is the edge/compute layer in front of it; Supabase is the durable backend behind it. No migration of these responsibilities.

### P4 — Rule of least power: native HTML + CSS first

**No front-end design/component framework.** Build with semantic **HTML first, CSS second, and the minimum JavaScript necessary** — in that order of preference (the rule of least power). Reach for the platform before writing bespoke code:

- Use modern native elements/APIs: **`<dialog>`** for modals, the **Popover API** (`popover`/`popovertarget`) for menus/tooltips, native **`<form>`** + constraint validation, `<details>`/`<summary>`, `<select>`, `inputmode`, anchor positioning, view transitions, container queries.
- Implement a bespoke widget **only** when no native element/API can do the job (or its support is genuinely inadequate) — and document why at the call site.
- Progressive enhancement: the markup should be meaningful and, where feasible, functional before JS hydrates.
- _Implication:_ v1 already uses native `<dialog>` (`Dialog.svelte`) — extend that posture everywhere (menus → popover, forms → native validation) rather than hand-rolling.

### P5 — Offline-first PWA, sync as enhancement

**Offline is the default operating mode, not a fallback.** Every user action completes against local state (IndexedDB) with zero network dependency; syncing to Supabase is an asynchronous enhancement layered on top (sync spec). The UI must never block on the network for a write, and must render honest offline/pending state (frontend spec §3.2, §3.6).

### P6 — Clean, DRY, maximal code reuse

**Don't repeat logic.** Anything used by more than one layer lives in one shared module and is imported, not re-implemented:

- **Shared client+server contracts:** mutation `type`/`payload` definitions and their **Zod schemas** are defined once and imported by both the client write-path and the `/api/sync` validator (sync spec §3, §5).
- **Pure domain logic** (`lib/money`, `lib/allocate`, `lib/settle`) is framework-agnostic and reused by UI, tests, and any server use — never duplicated into components (allocation spec §7). This is also what makes the v1 settlement logic, currently trapped inside `EntryPayments.svelte`, testable.
- **One way to do a thing:** a single DI style for mutation helpers, one locale/interpolation path, shared UI primitives in `base/*`. Prefer extracting a small reusable unit over copy-paste, but don't over-abstract speculatively — extract on the second use, not the first guess.

---

## Phase 0 — Decisions to settle first

These cut across multiple specs; deciding them up front avoids rework. Recommendations in **bold**.

**Status: all resolved.** Decisions below are locked for v1.

| Decision             | Options                                                                           | Decision                                                                               | Affects                          |
| -------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------- |
| Conflict granularity | per-column LWW vs row-level LWW                                                   | **DECIDED: per-column from the start** (`col_hlc` on every domain row)                 | sync, data-model                 |
| Identity linking     | `linked_user_id` column vs PK rewrite                                             | **DECIDED: `linked_user_id`**                                                          | auth, data-model, sync           |
| Anon→Google upgrade  | `linkIdentity` (same user_id) vs new user                                         | **DECIDED: `linkIdentity`** — verify manual linking is enabled in Supabase (Phase 1/3) | auth                             |
| Public editing       | `public_can_edit` flag vs public = read-only                                      | **DECIDED: public = read-only** (no public write in v1)                                | auth, data-model                 |
| Currency             | per-bill ISO currency vs hard-coded CAD                                           | **DECIDED: per-bill ISO currency**, integer minor units                                | allocation, data-model, frontend |
| Liveness transport   | Supabase Realtime vs custom                                                       | **DECIDED: Supabase Realtime + heartbeat**                                             | sync                             |
| Money type           | `bigint` minor units vs `numeric`                                                 | **DECIDED: `bigint`**                                                                  | data-model, allocation           |
| Tax/tip              | line items vs first-class bill fields                                             | **DECIDED: first-class `bills.tax`/`bills.tip`**, proportionally apportioned           | allocation, data-model           |
| Icon delivery        | `unplugin-icons`+`@iconify-json/tabler` vs inline outline paths via `Icon.svelte` | **DECIDED: `unplugin-icons`** (tree-shaken; never the `@tabler/icons-svelte` barrel)   | design-system, frontend          |
| Theme strategy       | `light-dark()`+`prefers-color-scheme` w/ `data-theme` override vs attribute-only  | **DECIDED: `light-dark()` default + `data-theme` override**                            | design-system                    |

---

## Phase 1 — Foundation: schema & RLS

> Spec: data-model. Nothing else can be correct until the source of truth is.

1. Enums: `bill_role (owner|editor|viewer)`, `payment_method`. Tables: `users`, `bills` (+`currency`, `visibility`), `bill_users` (`role`), `bill_contributors` (+`linked_user_id`), `bill_items`, `bill_item_splits`, `mutation_logs`, `invites`.
2. Money as `bigint` minor units with `CHECK` constraints (ceilings kept well under 2⁵³ so JS reads them as plain `number`); name-length + currency-code checks; first-class `bills.tax`/`bills.tip` (`bigint`, default 0).
3. Sync columns on every domain row: `hlc text`, `is_stub boolean default false`, `col_hlc jsonb` (per-column LWW — decided).
4. FKs/cascades; `mutation_logs.entity_id` FK-less (tombstones); decide `mutation_logs.user_id` delete rule.
5. RLS: `SECURITY DEFINER` access functions (recursion-safe), `(SELECT auth.uid())` wrapping, `is_stub` rows invisible, **no owner-absence / visibility=false write bypass**.
6. `ordered_bill_splits` view; `get_full_bill` authorizing internally.

**Exit:** RLS invariants 1–8 from the data-model spec pass against a seeded DB.

## Phase 2 — Sync engine

> Spec: sync. Depends on Phase 1 columns (`hlc`, `is_stub`, `mutation_logs`).

1. Client: IndexedDB layer with versioned migration list; stores `bills/users/outbox/cursors/meta`; atomic `commitMutations`.
2. HLC module (+ `node_id` in `meta`); `createMutation` stamps HLC + UUIDv7 and Zod-validates payload.
3. `SyncEngine`: single-flight push, **outbox-independent pull**, backoff+jitter, per-bill cursors.
4. Liveness: Realtime subscription on `mutation_logs` + visibility/online + heartbeat.
5. Server `POST /api/sync`: auth, per-mutation Zod validation, `sync_<type>` dispatch, push-then-pull.
6. SQL `sync_*` RPCs: `log_mutation` dedup gate, healing upserts (`is_stub` + HLC guard), LWW.
7. Compaction: `SNAPSHOT` mutation + log truncation (can land late in the phase).

**Exit:** sync acceptance scenarios 1–9 (offline burst, concurrent edits, out-of-order, dup delivery, idle receiver, delete propagation, cold start, clock skew).

## Phase 3 — Auth & invite

> Spec: auth. Depends on Phase 1 (`role`, `invites`, `visibility`) and Phase 2 (`is_stub`).

1. Anonymous sign-in (invisible Turnstile) + Google One-Tap (nonce flow); `safeGetSession` hooks.
2. Anon→permanent via `linkIdentity` (data carries over).
3. `invites` table + `join_bill_via_invite(token)` with expiry/max-uses/revoke; multiple live invites.
4. Roles enforced in RLS **and** `/api/sync`; access matrix from the auth spec.
5. Harden `SECURITY DEFINER` fns; `linked_user_id` linking guarded by caller check; rate-limit sync; offline-user recovery.

**Exit:** auth acceptance scenarios 1–9 (upgrade preserves data, expired/revoked invites, viewer can't write, public read-only, ghost inaccessible, authorized slot claim, offline recovery, no token leak).

## Phase 4 — Allocation & settlement

> Spec: allocation. Mostly independent — can be built in parallel from Phase 1 onward.

1. `lib/money` (scale/format/parse from per-bill currency).
2. `lib/allocate` — pure, **largest-remainder apportionment** (fixes the penny-drop bug), full breakdown + unaccounted tracking; **proportional tax/tip apportionment** (owing by subtotal, paid by item-payments).
3. `lib/settle` — pure greedy debtor↔creditor → `Transfer[]`, deterministic tie-break.
4. Exhaustive unit tests incl. the §5 edge cases and §6 invariants (`Σowing == cost`, `Σbalance == 0`, idempotent across devices).

**Exit:** allocation invariants hold for property-based/random bills; settlement zeroes all balances in ≤ n−1 transfers.

## Phase 5 — Frontend integration

> Specs: frontend + design-system. Integrates everything.

1. **Design-system foundation (do first):** promote `app.css` tokens into primitive+semantic tiers; `light-dark()` theming; type/space/motion scales; shared `base/*` primitives (`Button`, `ActionBar`, `Dialog`, `Popover`, `Field`, `Surface`); set `<html lang/dir>` and convert physical CSS → logical properties. Logo untouched.
2. **Icon migration:** Tabler **outline** via the Phase-0 delivery choice, behind the existing `Icon.svelte` contract; verify tree-shaking in a prod bundle.
3. `AppState` context (UserState/BillState/SyncState) wired to Phases 2–3.
4. Bill page reads **single source of truth** (`bills.byId`), HLC-ordered; discriminated `loading|ready|not_found|error` states (no infinite spinner).
5. Context for `user`/`locale`/`currency`; stop prop-drilling; one DI style for mutation helpers.
6. Editor components (grid/payments/summary/settings) on the pure allocation/settlement modules + per-bill currency; progression-button (`ActionBar`) convention in all dialogs/wizards.
7. Runtime i18n (`dir`/`lang`, `Intl.PluralRules`, missing-key CI guard); landing route prerendered/SSR; PWA offline indicator + update prompt.
8. **PWA durability + install (v1):** persistent-storage request; corrected SW cache scope (network-only `/api`/Supabase, app-shell nav fallback); SW-update↔IDB-migration sequencing; manifest completeness (maskable/apple icons, safe-area); **contextual install promotion after first bill** (Chromium `beforeinstallprompt` + iOS A2HS guidance); eviction re-hydration from Supabase.

**Exit:** frontend acceptance scenarios 1–11 + design-system acceptance scenarios 1–8.

## Phase 6 — Hardening & launch

- End-to-end Playwright across two simulated devices (real convergence test).
- Security pass: RLS fuzzing, `SECURITY DEFINER` audit, rate-limit verification, invite-leak check.
- Performance: cold-start from snapshot, large-bill allocation, sync under churn.
- Observability: sync failure/ backoff metrics, mutation-log growth, compaction health.
- **PWA durability:** request persistent storage; simulate storage eviction (and iOS 7-day non-installed eviction) → verify re-hydration from Supabase, no data-loss-as-truth; verify SW never caches `/api/*`/Supabase and that offline deep-links resolve via app-shell fallback; verify SW-update + IDB-migration sequencing; Lighthouse installability audit (manifest, maskable/apple icons, safe-area).

---

## Dependency graph

```
Phase 1 (schema/RLS) ──┬─> Phase 2 (sync) ──┐
                       ├─> Phase 3 (auth) ──┼─> Phase 5 (frontend) ─> Phase 6
                       └─> Phase 4 (alloc) ─┘
```

Phase 4 can start as soon as Phase 1 defines money/currency. Phases 2 and 3 share the `is_stub`/role columns from Phase 1 and should land before Phase 5 integration.

## Cross-cutting carry-overs from v1 (keep)

- Integer minor units for money (now DB-enforced).
- Mutation-log-as-dedup-ledger-and-feed; outbox atomic with local snapshot.
- Resilient idempotent RPCs (now with `is_stub` healing instead of sticky `'Syncing…'`).
- `safeGetSession` JWT validation; deploy-versioned service-worker cache.
- The `MaxHeap` (for settlement; allocation no longer needs it).

## Known v1 bugs these phases fix

- Allocation drops remainder cents when `remainder > contributorCount` → Phase 4 (largest-remainder).
- `'Syncing…'` ghost rows can stick → Phase 2 (`is_stub` + `DO UPDATE`).
- World-writable public bills + owner-absence bypass → Phases 1/3 (explicit roles, no bypass).
- Idle device never receives updates → Phase 2 (outbox-independent pull + Realtime).
- Infinite spinner on bill load failure → Phase 5 (discriminated states).
- Anonymous work orphaned on Google sign-in → Phase 3 (`linkIdentity`).
