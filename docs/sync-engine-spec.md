# Sync Engine Spec (v2)

A local-first, offline-capable, multi-device collaborative sync engine for a bill-splitting app. This is a clean redesign of the v1 engine, keeping what worked and fixing six known weaknesses.

## Goals

- **Local-first:** every edit applies instantly to local state; the network is never on the critical path.
- **Offline-capable:** edits queue durably and flush on reconnect.
- **Convergent:** all devices that have seen the same set of mutations reach byte-identical state (strong eventual consistency).
- **Live:** a passive viewer sees others' changes within ~1s, without having to make an edit first.
- **Resilient:** retries, reordering, duplicate delivery, and partial data are all safe (idempotent).
- **Cheap to operate:** small per-bill footprint; logs are compactable.

## What we keep from v1

| Pattern                                                               | Why it stays                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------------- |
| Optimistic local writes + denormalized bill snapshot in IndexedDB     | UI reads one record, never joins. Fast and simple.         |
| Append-only **mutation log** as both dedup ledger and event feed      | One structure powers idempotency _and_ fan-out.            |
| **Outbox** of pending mutations, atomic with the local snapshot write | Can't persist state without queuing its mutation.          |
| Idempotency keyed on a per-mutation UUID                              | Replay/echo/retry are all no-ops.                          |
| Resilient upserts that tolerate out-of-order arrival ("ghost rows")   | A child mutation arriving before its parent must not fail. |
| Convention-based RPC dispatch (`sync_<type>`)                         | Thin, boring server.                                       |

## What changes (the six fixes)

1. **Liveness** — add Realtime subscription + visibility/heartbeat polling. Receiving is decoupled from sending.
2. **Ordering** — replace wall-clock `created_at` LWW with **Hybrid Logical Clocks (HLC)** and **per-column versioning**, so concurrent edits to different fields don't clobber and clock skew can't reorder causally-related writes.
3. **Stub healing** — upserts use `DO UPDATE` guarded by HLC + an `is_stub` flag, so a real row always supersedes a placeholder.
4. **Cursors** — per-bill cursors + log compaction instead of one ever-growing global cursor.
5. **Validation** — shared Zod schemas validate every mutation payload at the server edge before dispatch.
6. **Storage migrations** — explicit, ordered IndexedDB migration list; version bumps always carry a matching upgrade block.

---

## 1. Data model

### Mutation (the wire + outbox unit)

```ts
interface Mutation<T extends MutationType = MutationType> {
  id: string; // UUIDv7 — sortable, embeds creation time
  type: T; // 'ADD_ITEM' | 'UPDATE_ITEM' | ...
  bill_id: string; // entity scope (partition key for cursors & realtime)
  user_id: string; // author
  hlc: string; // Hybrid Logical Clock, lexicographically comparable (see §2)
  payload: PayloadFor<T>; // validated by a Zod schema, never `any`
}
```

Two changes from v1: `created_at` is gone (the HLC carries causal time; `id` is a UUIDv7 for a stable secondary sort), and `payload` is strongly typed per `type`.

### Server tables

- **`mutation_logs`** — `(id PK, bill_id, user_id, type, payload jsonb, hlc text, seq_id bigserial)`. The global append-only feed. `seq_id` drives pull cursors; `id` enforces idempotency; `hlc` drives ordering.
- **Domain tables** (`bills`, `bill_contributors`, `bill_items`, `bill_item_splits`, `bill_users`) — each row carries:
  - `is_stub boolean default false` — true when created as a placeholder by an out-of-order child.
  - `col_hlc jsonb` — map of `{ column_name: hlc }` recording the HLC of the last write to each column (powers per-column LWW).

### Client (IndexedDB) stores

| Store     | Key       | Purpose                                          |
| --------- | --------- | ------------------------------------------------ |
| `bills`   | `id`      | Denormalized bill snapshots (UI source of truth) |
| `users`   | `id`      | Local user records                               |
| `outbox`  | `id`      | Pending mutations (FK-free; flushed on sync)     |
| `cursors` | `bill_id` | `{ bill_id, seq_id }` per-bill pull checkpoint   |
| `meta`    | `key`     | `last_user_id`, device `node_id`, last HLC, etc. |

---

## 2. Ordering: Hybrid Logical Clocks + per-column LWW

### HLC

Each device keeps an HLC: `{ wall: number, counter: number, node_id: string }`, serialized as a zero-padded, lexicographically-comparable string, e.g. `"000001700000000000-00042-<node>"`.

```
// on local event
now      = max(physical_now, last.wall)
wall     = now
counter  = (now == last.wall) ? last.counter + 1 : 0

// on receiving a remote hlc `r`
wall     = max(physical_now, last.wall, r.wall)
counter  = wall == last.wall == r.wall ? max(last.counter, r.counter) + 1
         : wall == last.wall           ? last.counter + 1
         : wall == r.wall              ? r.counter + 1
         : 0
```

HLC gives a **total order** that respects causality even under bounded clock skew. `node_id` breaks ties deterministically so every device picks the same winner.

### Per-column LWW

A mutation only carries the fields it changed. Apply each field independently:

```
for (col, value) in mutation.payload.fields:
    if mutation.hlc > row.col_hlc[col]:   // string compare
        row[col]      = value
        row.col_hlc[col] = mutation.hlc
```

Result: two users editing **different** fields of the same item concurrently both survive; two users editing the **same** field converge on the higher HLC. No clock-skew reordering of causally-related writes.

> **DECIDED (Phase-0): per-column LWW from the start.** Each domain row carries `col_hlc` (a `{column: hlc}` map); concurrent edits to different fields of the same row both survive. Row-level LWW (one HLC per row) was the considered alternative but rejected — it would drop an out-of-order edit to a different field of the same row.

---

## 3. Write path (client)

Identical shape to v1, atomic across stores:

1. Mutate the in-memory `BillData`.
2. `m = createMutation(type, payload, bill_id, user_id)` — stamps a fresh HLC + UUIDv7.
3. One IndexedDB readwrite txn over `["bills","users","outbox"]`: write the new snapshot **and** put `m` in the outbox. Either both commit or neither.
4. Nudge the sync pump.

`createMutation` validates `payload` against its Zod schema **before** it touches the outbox, so malformed mutations can't be persisted locally either.

---

## 4. Sync pump (client)

A single-flight loop, but with liveness decoupled from the outbox:

```
class SyncEngine {
  // PUSH path
  apply(m) { outbox.push(m); schedulePush(); }

  async push() {
    if (inFlight || offline) return;
    inFlight = true;
    const batch = outbox.forUser(currentUser);            // partition by user
    const res = await POST('/api/sync', {
      mutations: batch,
      cursors: this.cursorsForActiveBills(),               // per-bill {bill_id: seq_id}
    });
    removeFromOutbox(res.processedIds);
    await applyIncoming(res.newMutations.filter(notMine(res.processedIds)));
    advanceCursors(res.cursors);
    backoff.onResult(res.processedIds.length > 0);         // reset vs. exponential
    inFlight = false;
    if (outbox.nonEmpty) schedulePush(backoff.next());     // jittered
  }

  // PULL path — runs even when the outbox is empty (the v1 gap)
  async pull() { /* same as push() but with mutations: [] */ }
}
```

**Liveness sources** (any of these triggers `pull()`):

- **Realtime:** subscribe to `mutation_logs` inserts filtered to the user's bills (Supabase Realtime + RLS). On notify → `pull()`.
- **Visibility:** on `visibilitychange` → visible, and on `online`, → `pull()`.
- **Heartbeat:** while the tab is visible, `pull()` every ~30s as a safety net if a Realtime message is missed.

This removes the v1 defect where an idle device with an empty outbox never received updates.

**Backoff:** 1s → ×2 → 128s cap, ±20% jitter; reset on any push progress. Unchanged from v1, applied to the push path only.

---

## 5. Server endpoint (`POST /api/sync`)

```
1. Authenticate. Reject if no session.
2. Validate body shape (Zod). For each mutation:
     a. if m.user_id !== session.user.id  → skip (defense in depth; RLS also enforces).
     b. validate m.payload against schemaFor(m.type)  → on fail, skip + record reason.
     c. supabase.rpc(`sync_${m.type.toLowerCase()}`, { ...m }).
     d. on success → processedIds.push(m.id); on error → leave in outbox (log it).
3. For each requested bill cursor, pull mutation_logs where bill_id = B and seq_id > cursor[B],
   ordered by seq_id asc. (RLS scopes to bills the user may read.)
4. Return { processedIds, newMutations, cursors: { [bill_id]: latestSeqId } }.
```

Push-before-pull in one round-trip is retained; the client filters its own just-acked mutations out of `newMutations` by `processedIds`.

---

## 6. SQL: idempotency + healing

Every `sync_*` function opens with the dedup gate and heals stubs on conflict.

```sql
-- Dedup ledger + user upsert (returns FALSE if already applied)
create or replace function log_mutation(p_id uuid, p_bill uuid, p_user uuid,
                                         p_type text, p_payload jsonb, p_hlc text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  insert into users(id) values (p_user) on conflict (id) do nothing;
  if exists (select 1 from mutation_logs where id = p_id) then return false; end if;
  insert into mutation_logs(id, bill_id, user_id, type, payload, hlc)
  values (p_id, p_bill, p_user, p_type, p_payload, p_hlc);
  return true;
end $$;
```

Healing upsert pattern (illustrated for an item):

```sql
insert into bill_items(id, bill_id, name, cost, is_stub, col_hlc)
values (v_id, p_bill, v_name, v_cost, false, jsonb_build_object('name',p_hlc,'cost',p_hlc))
on conflict (id) do update set
  -- a real row always supersedes a stub; otherwise per-column HLC wins
  name  = case when bill_items.is_stub
               or p_hlc > coalesce(bill_items.col_hlc->>'name','')
          then excluded.name else bill_items.name end,
  cost  = case when bill_items.is_stub
               or p_hlc > coalesce(bill_items.col_hlc->>'cost','')
          then excluded.cost else bill_items.cost end,
  is_stub = false,
  col_hlc = bill_items.col_hlc || excluded.col_hlc;
```

A child that arrives early still inserts a `is_stub=true` placeholder (parents ensured first, `DO NOTHING`), and the eventual real mutation overwrites it because `is_stub` forces the update. This fixes the v1 "`Syncing...` sticks forever" bug.

---

## 7. Deletion propagation

Hard-delete domain rows, but keep the `DELETE_*` mutation in `mutation_logs` so peers learn about it. RLS on `mutation_logs` SELECT must allow a user to read a deletion even after they've lost membership:

```sql
using (
  exists (select 1 from bill_users
          where bill_users.bill_id = mutation_logs.bill_id
            and bill_users.user_id = (select auth.uid()))
  or user_id = (select auth.uid())
  or payload->'member_ids' @> jsonb_build_array((select auth.uid())::text)
)
```

The third clause: include a `member_ids` snapshot in delete payloads so a just-removed member still receives the "you were removed" event.

---

## 8. Compaction

`mutation_logs` grows forever otherwise. Periodically, per bill:

1. Write a single `SNAPSHOT` mutation containing the current full bill state, stamped with the max HLC seen.
2. Delete logs with `seq_id` below the snapshot.
3. Clients whose cursor predates the snapshot receive the `SNAPSHOT` and replace local state wholesale (it's just `CREATE_BILL` semantics).

New devices / cold caches always start from the latest snapshot + tail, never the full history.

---

## 9. Storage migrations (client)

```ts
const MIGRATIONS: Array<(db: IDBDatabase, tx: IDBTransaction) => void> = [
  /* v1 */ (db) => {
    db.createObjectStore("bills", { keyPath: "id" });
    db.createObjectStore("users", { keyPath: "id" });
  },
  /* v2 */ (db) => {
    db.createObjectStore("outbox", { keyPath: "id" }).createIndex("hlc", "hlc");
  },
  /* v3 */ (db) => {
    db.createObjectStore("cursors", { keyPath: "bill_id" });
    db.createObjectStore("meta", { keyPath: "key" });
  },
];
const DB_VERSION = MIGRATIONS.length; // version and migrations can never drift
// onupgradeneeded: run MIGRATIONS[oldVersion .. newVersion-1]
```

Version is _derived_ from the migration list, so you can never bump the version without a matching block (the v1 trap).

---

## 10. Acceptance scenarios (test matrix)

Each must converge to identical state on all devices:

1. **Offline burst → reconnect:** make 20 edits offline; all flush in order; no dupes.
2. **Concurrent different-field edit:** A edits item name, B edits same item's cost simultaneously → both survive.
3. **Concurrent same-field edit:** A and B set the same name → higher HLC wins on both devices.
4. **Out-of-order child:** `ADD_SPLIT` delivered before its `ADD_ITEM` → no FK error; stub heals to real values, no `Syncing...` residue.
5. **Duplicate delivery:** the same mutation delivered 3× (retry + 2 echoes) → applied exactly once.
6. **Idle receiver:** device with empty outbox, tab open, makes no edits → sees a peer's edit within ~1s (Realtime) / ≤30s (heartbeat).
7. **Delete propagation to removed member:** owner removes B → B's device purges the bill and the listing.
8. **Cold start after compaction:** new device joins a bill with a truncated log → loads from `SNAPSHOT` + tail correctly.
9. **Clock skew:** device clock +10min → causally-later writes still order after earlier ones (HLC, not wall clock).

---

## 11. Open decisions for the new project

- **Per-column vs row-level LWW** (§2) — per-column is correct but adds `col_hlc` bookkeeping. Pick based on how often two people edit the same row.
- **Realtime transport** — Supabase Realtime (simplest with the existing stack) vs. a custom WebSocket/SSE. Realtime + heartbeat is recommended.
- **Compaction trigger** — cron vs. on-write threshold (e.g. >500 logs/bill). Start with a nightly cron.
- **Money type** — keep integer minor units (cents) end-to-end as v1 did; never floats.

```

```
