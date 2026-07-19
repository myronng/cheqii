# Plan — richer cheque cards + "Bills → Cheques" rename

Two threads, planned together because the design files use "cheque" language:

1. **Richer listing cards** — replace the minimal name+date list with the uploaded
   card-grid design (`ChequeCard` + `ChequesPage`), fitted to our tokens/components.
2. **Rename "Bill" → "Cheque"** across the product, scoped carefully.

Source design files: `ChequeCard.svelte`, `ChequesPage.svelte` (standalone Svelte,
plain CSS, local `--ck-*` vars). We will NOT drop them in as-is — we reimplement
their layout on our design system (semantic tokens, our base components, no shadows,
logical properties, localized strings), exactly as we did for the marketing landing.

---

## Part A — The richer cheque card

### What the new card shows (all derivable client-side, no new fetch)

Per cheque, from the in-memory `BillData` snapshot (`app.bills`):

| Card element              | Source                                                                 |
| ------------------------- | ---------------------------------------------------------------------- |
| Title                     | `bill.name`                                                            |
| Meta: "N items · <ago>"   | non-stub `bill_items.length` + relative time from `bill.updated_at`    |
| Member avatars (initials) | `bill_contributors` → first letter of `name`; "+N" overflow            |
| Item preview (≤3 + more)  | non-stub `bill_items` (name + `getNumericDisplay(AMOUNT_FORMATTER,…)`) |
| Grand total               | Σ non-stub `bill_items[].cost` (already what `allocate()` returns)     |
| Your balance / state      | see below — `allocate()` + `settle()` on the snapshot                  |

### The three balance states (map to existing logic)

`EntryPayments.isAuthenticatedUserLinked` already encodes the distinction:

- **unlinked** — current user is a member (`bill_users`) but no contributor has
  `id === userId || linked_user_id === userId`. (Happens after joining via invite —
  the join RPC adds membership only.) → card shows **"Claim your spot"**, linking to
  the cheque where `EntryPayments` already offers the claim action.
- **linked** — find the user's contributor, run `allocate()`+`settle()` on the
  snapshot, take `paid.total − owing.total`:
  - `> 0` → **"You're owed +X"** (action color)
  - `< 0` → **"You owe −X"** (error color)
  - `= 0` → **"Settled up"** ⚠️ (the design has no zero state — see decision #4)

We will extract a small pure helper `myBalance(billData, userId)` (in
`state/model.ts` or a `domain/` file) returning `{ state, amount }`, reused by BOTH
the card and `EntrySummary` (which computes the same number today) to avoid drift.

### Components — reuse, don't reinvent

The uploaded `ChequesPage` re-implements a header, brand mark, "New cheque",
"Sign in", and pagination that we already have. Mapping:

| Uploaded design element             | Our existing equivalent (reuse)                                           |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `.hdr` brand + name svg             | `MainHeader` + `Logo`                                                     |
| `.hdr-new` "New cheque"             | `MainNewBillButton` (→ rename `MainNewChequeButton`)                      |
| `.hdr-signin` / "Sign in"           | `AccountButton` / `GoogleSignIn` (permanent-user avatar)                  |
| `.title-row` "Your cheques" + count | new markup, localized `yourCheques` + count                               |
| `.new-tile` dashed New tile         | new markup; click → `createNewCheque(...)` helper                         |
| `ChequeCard`                        | new `MainChequeCard.svelte` (replaces `MainBill`)                         |
| `.avatar` initials                  | **extract `base/Avatar.svelte`** (dup'd in AccountButton + MarketingHero) |
| `.pager`                            | see decision #3 (pagination)                                              |

New/changed files (Part A): `MainChequeCard.svelte` (new, replaces `MainBill`),
`MainListing.svelte` (grid + new-tile + title-row + optional pager),
`base/Avatar.svelte` (new, extracted), `formatter.ts` (+ relative-time fn),
`state/model.ts` (+ `myBalance` helper), `(app)/…/+page.server.ts` (+ new strings).

### Design-system reconciliation (we follow OUR standards)

The uploaded CSS must be translated, not copied:

- **No shadows.** The card uses `box-shadow` + a hover lift; the empty state and CTA
  use glows. Our app uses no drop shadows. → drop the card shadow + translate the
  hover to a token move (e.g. `border-color`/`--color-surface`); keep ONLY the single
  CTA-style glow (consistent with the landing) on the empty-state primary button.
- **Tokens, not literals.** Replace every `--ck-*` and hex/px with our semantic vars
  and `--space-*`/`--text-*`/`--radius-card`/`--border-divider` scale. The card's
  `20px` radius snaps to `--radius-card` (16px); the px type sizes snap to the nearest
  scale steps. (Minor proportion shifts — acceptable, keeps us on-system.)
- **Logical properties** (`inline-size`, `block-size`, `margin-block-*`) to match the
  codebase and RTL support.
- **Fonts** already global (Comfortaa + JetBrains Mono); amounts/initials use mono.
- **Sentence case** everywhere (brand rule): "New cheque", "Your cheques", "Claim
  your spot", "You're owed", "You owe", "Settled up".

---

### Pagination (decided: yes)

The list can grow large, so we paginate. All cheque snapshots are already in memory,
so pagination is **client-side over the sorted in-memory array** — no server
round-trips. Reuse the design's numbered pager (Prev / 1 2 3 / Next), translated to
our tokens/`Button`. Page size is a tunable constant; default ~**11** so that with the
"New cheque" tile the first page is a clean 12 cells (≈4 rows × 3 cols on desktop).

### Zero-balance (decided: fold into owed)

A linked user with net 0 shows **"You're owed +0.00"** in the action color. No
separate "Settled up" state.

---

## Part B — Rename "Bill" → "Cheque" (decided: FULL rename, incl. DB + protocol)

Scope ~50 files / ~1300 occurrences, across both layers. Because this touches the
deployed Postgres schema, the wire protocol, and every device's IndexedDB, it ships
as ONE coordinated migration + deploy (not incrementally).

> ⚠️ **Assumption to confirm:** prod has little/no real user data yet (this is the v2
> rebuild). Table renames preserve rows; the mutation-log history and local IndexedDB
> caches are migrated/reset as below. If real users with unsynced local data exist,
> we'd need a compatibility window instead — flag before running.

### B1 — Routing (decided: app home at `/`, a cheque at `/cheques/[id]`)

- App listing lives at the app-host **root `/`** (not `/cheques`). Detail at
  `/cheques/[chequeId]`; invite at `/invite/[chequeId]`; API at `/api/cheques`.
- One Worker serves both `cheqii.com` (marketing `/`) and `app.cheqii.com` (app `/`),
  so we use a **host-aware `reroute` hook** (`src/hooks.ts`): on the app host, `/`
  renders the listing route while the URL stays `/`; on the apex host, `/` stays the
  marketing landing. The listing route file lives in the `(app)` group (so it gets the
  ssr=false boot layout) but is surfaced at `/` via reroute.
- `hooks.server.ts`: replace the `app.cheqii.com/ → /bills` 301 with serving `/`
  directly; 301 the bare `app.cheqii.com/cheques` → `/` (one canonical list URL);
  update `isAppPath` (drop `/bills`, add `/cheques`, keep `/new`, `/invite`); keep the
  apex/app split. Add **301 `/bills*` → the new paths** for existing installs/bookmarks
  and already-issued invite links.

### B2 — Client code (types, functions, components, strings)

- Types/classes: `BillData`→`ChequeData`, `BillState`→`ChequeState`,
  `BillRow`/`BillUserRow`/etc. (these alias generated DB types — regenerate after B3).
- Functions: `createBill`→`createCheque`, `starterBill`, `deleteBill`, `leaveBill`,
  `flattenServerBill`, `NewBill`, `createNewBill`, `updateBill`, `updateBillUser`, …
- Components: `MainBill`→`MainChequeCard`, `MainNewBillButton`→`MainNewChequeButton`;
  `Entry*` prop `billData`→`chequeData`.
- Locale strings (13 keys): `newBill`→`newCheque`, `bill`/`bill{date}`/`billName`,
  `deleteBill`, `leaveBill`, `yourBills`→`yourCheques`, `youHaveNoBills`, the three
  "…access this bill" strings, `installToKeepYourBillsOnThisDevice`,
  `thisWillDeleteTheBillForAllUsers`, `a{collaborative}BillSplitter` (key only).
- Variables/comments/CSS: `billId`→`chequeId`, etc.

### B3 — Database migration (new SQL migration)

- `ALTER TABLE … RENAME` for `bills`→`cheques`, `bill_users`→`cheque_users`,
  `bill_items`→`cheque_items`, `bill_contributors`→`cheque_contributors`,
  `bill_item_splits`→`cheque_item_splits`; rename `bill_id`→`cheque_id` columns;
  rename enums `bill_role`/`bill_visibility`, the `ordered_bill_splits` view, and the
  ~6 `idx_bill_*` indexes. Renames preserve data + FKs.
- `DROP` + `CREATE` the 14 `sync_*` RPCs and `_ensure_stub_bill` with the new
  table/column names and new function names (`sync_create_cheque`, …).
- **Mutation-type enum** in `mutation_logs.type`: migrate existing values
  (`UPDATE mutation_logs SET type = replace(type,'BILL','CHEQUE')`), and update any
  CHECK constraint / dispatch SQL. Update `rpcNameFor()` (still `sync_${type…}`).
- Regenerate `src/lib/utils/models/database.ts` types from the new schema.

### B4 — Wire protocol + IndexedDB

- Wire mutation-type enum strings: `CREATE_BILL`→`CREATE_CHEQUE`, `UPDATE_BILL`,
  `DELETE_BILL`, `UPDATE_BILL_USER`, `DELETE_BILL_USER` in `src/lib/sync/mutations.ts`
  (Zod `PAYLOAD_SCHEMAS` keys, `MutationType`, `MUTATION_TYPES`).
- IndexedDB: add a DB-version migration that creates the `"cheques"` object store
  (and renames `StoreName`/`SnapshotWrite`). Since the server is the source of truth,
  the migration can create the new store and let the engine re-pull, rather than
  copying — simplest and self-healing. Drop the old `"bills"` store.

---

## Sequencing

1. Part A on the current route first (card grid + `myBalance` + `Avatar` + relative
   time + client pagination), verified locally — pure UI/derivation, low risk, and
   independent of the rename.
2. Part B as ONE coordinated change: SQL migration (B3) → regen types → client rename
   (B2) + wire/IDB (B4) → routing (B1) → 301s. Verify locally against a freshly
   migrated local Supabase.
3. Apply the migration to prod Supabase, build, deploy, verify live on app.cheqii.com
   (list at `/`, a cheque at `/cheques/<id>`, old `/bills*` 301s, sync round-trips).

## Resolved decisions

1. Rename scope: **full** — code + UI **and** DB tables/columns, RPCs, wire enum, IDB.
2. Routes: app home at **`/`** (host-aware reroute); a cheque at **`/cheques/[id]`**;
   301 from old `/bills*`.
3. Pagination: **yes**, client-side numbered pager over the in-memory list.
4. Zero balance: **"You're owed +0.00"** (no separate settled state).

## Lower-stakes defaults (proceeding unless told otherwise)

- Member avatars = `cheque_contributors` (all named people), not just linked accounts.
- Per-item preview amount = the item's full cost (matches the design), not user share.
- Drop card shadow + hover-lift per our no-shadow standard; keep only the CTA glow.
- Snap radius/type/spacing to our scale (slight proportion shift from the mock).
