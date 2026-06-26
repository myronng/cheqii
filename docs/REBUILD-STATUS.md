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

## How the SQL was validated (no Supabase CLI needed)

`docker`/`podman` is available with `public.ecr.aws/supabase/postgres:17.6.1.011` cached. Run a container, apply `supabase/migrations/2026*.sql` in order via `psql`, exercise the RPCs. (auth.users/auth.uid()/role `authenticated` already exist in that image.) See prior session for the exact harness; the pattern: `docker run -d … postgres:17`, wait for `pg_isready`, pipe each migration through `psql -v ON_ERROR_STOP=1`, then call `sync_*` functions with seeded `auth.users` rows.

## Next up — Phase 2 part 2 (runtime layer)

Needs the toolchain (`pnpm install`; note: only `node` is on PATH so far — `pnpm`/`vp` not yet; install deps first so TS is runnable/testable):

- Client **IndexedDB layer** — stores `bills/users/outbox/cursors/meta`, versioned migration list, atomic `commitMutations`.
- **SyncEngine pump** — single-flight push, **outbox-independent pull**, backoff+jitter, per-bill cursors.
- **`/api/sync` endpoint** — auth, Zod-validate each mutation (`parseMutation`), dispatch via `rpcNameFor`, push-then-pull.
- **Realtime liveness** — Supabase Realtime on `mutation_logs` + visibility/online + heartbeat.
- **Compaction** — `SNAPSHOT` mutation + log truncation.

Then Phase 3 (auth/invite incl. `join_bill_via_invite` RPC), Phase 4 (allocation libs: largest-remainder + proportional tax/tip + settlement), Phase 5 (frontend + design system + icons), Phase 6 (hardening incl. an as-`authenticated`-role JWT RLS integration test, which is the one piece still unverified).

## Resuming on another machine

1. `git fetch && git checkout worktree-v2-rebuild` (or recreate a worktree on it).
2. Open a fresh Claude Code session in the repo and point it at `docs/implementation-plan.md` + this file.
3. Continue from "Next up" above.
