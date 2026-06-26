# Rebuild Status & Session Handoff

Living status doc for the cheqii v2 rebuild. **A fresh Claude Code session can read this + the other `docs/` specs to pick up exactly where the last one left off** — the prior conversation transcript and Claude's local memory files do NOT transfer between machines, so this committed doc is the source of truth for "where we are."

_Last updated: 2026-06-25, end of Phase 2 part 1._

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

## After Phase 3

**Phase 4 (allocation libs)** — `lib/money`, `lib/allocate` (largest-remainder + proportional tax/tip), `lib/settle`; mostly independent, fully unit-testable. Good candidate for next.
**Phase 5 (frontend + design system + icons)** — also retires the leftover v1 files (the ~52 type errors) and absorbs the deferred Phase-3 client UX (offline recovery, invite management UI).
**Phase 6 (hardening)** — rate-limiting, live linkIdentity/OAuth e2e, as-`authenticated`-role JWT RLS integration test (still unverified), compaction if not done earlier.

## Resuming on another machine

1. `git fetch && git checkout worktree-v2-rebuild` (or recreate a worktree on it).
2. Open a fresh Claude Code session in the repo and point it at `docs/implementation-plan.md` + this file.
3. Continue from "Next up" above.
