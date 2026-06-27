# Data Model & RLS Spec (v2)

The Postgres schema, relationships, and row-level-security architecture. This is the **convergence point** for the other three specs — it materializes the columns and constraints that the sync (HLC, stubs, cursors), allocation (integer money), and auth (roles, invites, linked identity) specs assume.

## Goals

- **Integrity at the database, not just the client:** money is integer minor units with CHECK constraints; access is enforced by RLS as the backstop.
- **Tombstone-friendly:** deletions of domain rows must not erase the event log that propagates them.
- **Recursion-safe RLS:** membership checks can't trigger infinite policy evaluation.
- **Aligned with the other specs:** every column the sync/auth/allocation v2 designs need exists here.

---

## 1. v1 schema (as built)

### Enums

- `bill_authority` = `owner | invited | public`
- `payment_method` = `etransfer | payPal`

### Tables

| Table               | PK                   | Notable columns                                                                                | Comment                                                                    |
| ------------------- | -------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `users`             | `id`                 | `default_invite_required` bool, `default_payment_id` text, `default_payment_method`            | `id` → `auth.users(id)` ON DELETE CASCADE. App-specific profile data.      |
| `bills`             | `id`                 | `invite_id` uuid, `invite_required` bool (default **false**), `name`                           | Header only; **no owner column** (ownership lives in `bill_users`).        |
| `bill_users`        | `(user_id, bill_id)` | `authority` (default **`public`**), `payment_id`, `payment_method`                             | Membership + per-bill payment info.                                        |
| `bill_contributors` | **`(bill_id, id)`**  | `name`, `sort` numeric                                                                         | "Columns" of the bill grid. Composite PK.                                  |
| `bill_items`        | `id`                 | `contributor_id` (payer), `cost` **numeric**, `sort` numeric, `bill_id`                        | "Rows" of the grid. FK `(contributor_id, bill_id)` → contributors.         |
| `bill_item_splits`  | `id`                 | `item_id`, `contributor_id`, `ratio` **numeric**, `bill_id`                                    | Per-item ratio per contributor.                                            |
| `mutation_logs`     | `id`                 | `entity_id`, `mutation_type` text, `payload` jsonb, `user_id`, `created_at`, `seq_id` IDENTITY | Global append-only event log. Indexed on `entity_id`, `seq_id`, `user_id`. |

### Relationships & cascades

- All `bill_*` children FK to `bills(id)` **ON UPDATE CASCADE ON DELETE CASCADE** → deleting a bill cleans up everything.
- `bill_items`/`bill_item_splits` FK to `bill_contributors(id, bill_id)` **ON UPDATE CASCADE** → this is what lets `link_contributor_account` rewrite a contributor's PK and have items/splits follow.
- `mutation_logs.user_id` → `users(id)` with **no ON DELETE rule**; `mutation_logs.entity_id` has **no FK** (deliberate — logs must outlive deleted bills as tombstones).

### View

- `ordered_bill_splits` (`security_invoker = true`) — joins splits ↔ items ↔ contributors and exposes `item_sort_order` / `contributor_sort_order`. Used by `get_full_bill` to assemble the nested JSON.

### RLS architecture

- RLS enabled on all 7 tables.
- Domain tables delegate to `check_user_has_bill_read_access` / `_write_access`, which are **`SECURITY DEFINER`**. This is load-bearing: they query `bill_users`, which itself has RLS that calls the same functions — running as definer (owner, RLS-exempt) **breaks the recursion**. Wrapping `auth.uid()` in `(SELECT auth.uid())` makes it evaluate once per query, not per row.
- `users`: own-row only. `mutation_logs`: insert only your own; select if you're a member, the author, or in a deleted bill's `member_ids` snapshot.

---

## 2. Sharp edges in v1 (must address)

1. **Money is `numeric`, not integer minor units.** The app treats `cost`/`ratio` as integers (cents/whole ratios) but the column type is arbitrary-precision `numeric`. Nothing stops a client writing `3.337` cents; `numeric` can also round-trip as a string in some drivers. The integrity guarantee the allocation spec needs (`Σowing == cost`, exact) isn't enforced where it matters.
2. **No CHECK constraints.** `CURRENCY_MIN/MAX` and `SPLIT_MIN/MAX` exist only in client `formatter.ts`. The DB accepts negative costs, negative ratios, absurd magnitudes.
3. **`bill_users.authority` defaults to `public`** and `bills.invite_required` defaults to `false` — the two defaults combine (via the auth spec's access bypass) into "world-writable unless you opt out." Defaults should be safe.
4. **PK rewriting for identity linking** (`link_contributor_account`) is only possible because of `ON UPDATE CASCADE` everywhere — structurally heavy and hostile to multi-device sync (peers reference the old id). The auth spec recommends a `linked_user_id` column instead.
5. **`mutation_logs.user_id` FK has no delete rule** — deleting a `users` row will fail or orphan if logs reference it; `DELETE_USER` flows need a defined policy (set null / cascade / restrict).
6. **Single global `seq_id` sequence** is the only ordering key — a write hotspot at scale and the reason the sync spec wants per-bill cursors + compaction.
7. **`updated_at` is wall-clock and app-managed** (RPCs set it to the client `created_at` for LWW). The sync spec replaces this with HLC columns; the schema must carry them.

---

## 3. v2 schema changes

### 3.1 Money & numeric integrity

- `bill_items.cost` → `bigint` (minor units), `CHECK (cost >= 0 AND cost <= 999999999)`.
- `bill_item_splits.ratio` → `integer`, `CHECK (ratio >= 0 AND ratio <= 9999999)`.
- `sort` keeps a fractional/ordered type (`numeric` or a text LexoRank) to allow insertion between rows without renumbering; make it `NOT NULL DEFAULT 0` consistently.
- **No `bills.currency`, `bills.tax`, `bills.tip`.** Bills are currency-agnostic (plain decimals, fixed minor-unit scale 100, no symbol) and line items are entered tax/tip-inclusive — these columns were dropped in `20260626000001_v2_remove_tax_tip_currency` (allocation spec § "Tax & tip — REMOVED").
- **`bigint` ↔ JavaScript (no casting trap):** amounts are read back as a JS **`number`** — PostgREST returns `int8` as a JSON number and Supabase's generated types type it as `number`. Because every amount is capped far below `Number.MAX_SAFE_INTEGER` (2⁵³−1 ≈ 9.0×10¹⁵) by the CHECK ceilings (~$10M), there is **no precision loss and no need for the JS `BigInt` type** — use plain `number` throughout. `bigint` is chosen only for storage headroom (and because Postgres `SUM(int)` promotes to `bigint` anyway). Rule: keep CHECK ceilings well under 2⁵³.
- Name length CHECKs on `bills.name`, `bill_items.name`, `bill_contributors.name`.

### 3.2 Roles & safe defaults (from auth spec)

- Rename `bill_authority` → `owner | editor | viewer` (migrate `invited`→`editor`, `public`→`viewer`).
- `bill_users.role` **no default** (or default `viewer` only with explicit intent) — membership rows are always created with an explicit role by `CREATE_BILL` / `join_bill_via_invite`.
- Add `bills.visibility` = `private | public_read | public_edit` (default `private`), replacing the overloaded `invite_required` boolean. Access checks read this explicitly — **no "absence of owner" or "invite_required=false" write bypass.**

### 3.3 Sync columns (from sync spec)

- Add to every domain row: `hlc text NOT NULL`, `is_stub boolean NOT NULL DEFAULT false`, and `col_hlc jsonb NOT NULL DEFAULT '{}'` (per-column LWW — Phase-0 decision).
- RLS read/write checks treat `is_stub = true` rows as **inaccessible to everyone but the system**, closing the ghost-bill exposure.
- `mutation_logs` gains `hlc text`; keep `seq_id` as the pull cursor but support per-bill cursors via the existing `entity_id` index (composite index `(entity_id, seq_id)`).

### 3.4 Invites table (from auth spec)

```sql
create table invites (
  id uuid primary key default gen_random_uuid(),   -- the token
  bill_id uuid not null references bills(id) on delete cascade,
  role bill_role not null,
  created_by uuid not null references users(id),
  expires_at timestamptz,
  max_uses int,
  uses int not null default 0,
  revoked_at timestamptz
);
```

Replaces the single `bills.invite_id` shared secret. Multiple live invites per bill, each scoped/expirable/revocable.

### 3.5 Identity linking without PK churn

- Add `bill_contributors.linked_user_id uuid references users(id)`; resolve "this contributor is you" by `linked_user_id` instead of rewriting the contributor PK. Drop the reliance on `ON UPDATE CASCADE` for identity (keep it for legitimate key edits if any).

### 3.6 FK / lifecycle fixes

- `mutation_logs.user_id` → define `ON DELETE SET NULL` (preserve tombstones authored by a now-deleted user) or a dedicated `DELETE_USER` policy. Decide explicitly.
- Keep `mutation_logs.entity_id` FK-less (tombstone survival) — document it as intentional.

---

## 4. Target ERD (v2)

```
auth.users ──1:1──> users ──< bill_users >── bills ──< invites
                      │                         │
                      │                         ├──< bill_contributors (linked_user_id ─┐)
                      │                         ├──< bill_items ──< bill_item_splits     │
                      └──< mutation_logs (entity_id → bills, FK-less tombstone) ─────────┘
```

- `bill_items.contributor_id` and `bill_item_splits.contributor_id` → `bill_contributors(id, bill_id)`.
- `ordered_bill_splits` view unchanged in spirit; `get_full_bill` authorizes internally (auth spec).

---

## 5. RLS invariants (acceptance)

1. A non-member cannot SELECT any row of a `private` bill (bill, items, splits, contributors, users, or its mutation logs).
2. A `viewer` can SELECT all bill rows but every INSERT/UPDATE/DELETE is denied.
3. `editor`/`owner` can write all domain rows; only `owner` can delete the bill or manage invites/roles.
4. `is_stub = true` rows are invisible to all non-system callers.
5. Membership checks never recurse infinitely (DEFINER functions verified RLS-exempt internally).
6. Deleting a bill cascades to all `bill_*` and `invites` rows but **leaves `mutation_logs` tombstones intact**, and former members can still read the `DELETE_BILL` log.
7. DB rejects: negative `cost`/`ratio`, fractional minor units, over-long names, invalid currency codes.
8. `Σ split.ratio` and `cost` are always integers → the allocation spec's exactness holds at the source of truth.

---

## 6. Migration notes (v1 → v2, if ever needed rather than greenfield)

- `numeric → bigint` for `cost`: multiply by minor-unit scale only if v1 stored major units; v1 already stored minor units as numeric, so it's a type narrowing with a `CHECK` — verify no fractional data exists first.
- Enum rename needs `ALTER TYPE ... RENAME VALUE` (Postgres 10+) or a new type + column swap.
- Backfill `hlc` for existing rows from `updated_at` (wall clock → seed HLC).
- This project is **greenfield**, so prefer defining the target schema directly and porting data via the sync log if any real data exists.

---

## 7. Open decisions

- **`numeric` vs `bigint` ceiling** — `bigint` minor units cap at ~92 quadrillion; fine. Confirm no need for `numeric` precision (e.g., crypto amounts) — unlikely for a bill-splitter.
- **`sort` representation** — fractional `numeric` (simple) vs LexoRank text (robust against precision exhaustion after many reorders).
- **`DELETE_USER` FK policy** — `SET NULL` on `mutation_logs.user_id` vs. anonymizing vs. restricting. Tied to GDPR-style "delete my account" behavior.
- ~~Per-column vs row-level `col_hlc`~~ — **RESOLVED (Phase-0): per-column.** `col_hlc` is required on every domain row.
