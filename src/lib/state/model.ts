/**
 * v2 client-side model types: the denormalized snapshots the UI reads (one record
 * per bill, never a join) and the local user record. Derived from the generated
 * Supabase Row types so they stay aligned to the live schema (data-model spec).
 *
 * Every domain row carries `hlc` + `col_hlc` (a {column: hlc} map), mirroring the
 * server, so the client reducer can do per-column LWW and never regress a newer
 * local edit when applying a peer's pulled mutation. See docs/sync-engine-spec.md §2.
 */
import type { Database } from "$lib/utils/models/database";

type Tables = Database["public"]["Tables"];

export type BillRow = Tables["bills"]["Row"];
export type ContributorRow = Tables["bill_contributors"]["Row"];
export type ItemRow = Tables["bill_items"]["Row"];
export type SplitRow = Tables["bill_item_splits"]["Row"];
export type BillUserRow = Tables["bill_users"]["Row"];
export type UserRow = Tables["users"]["Row"];

/** Per-column HLC map: `{ columnName: hlc }`. Stored as jsonb (`Json`) on the row. */
export type ColHlc = Record<string, string>;

/**
 * The bill snapshot — the UI source of truth. Mirrors the DB tables **flat**
 * (splits are NOT nested under items): a `UPDATE_SPLIT {id, ratio}` can arrive
 * before its item, so splits must be placeable without a known parent (matching
 * the server's nullable `item_id` + stub-healing). `itemSplits()` regroups them
 * for the allocate lib at render time.
 */
export type BillData = BillRow & {
  bill_contributors: ContributorRow[];
  bill_items: ItemRow[];
  bill_item_splits: SplitRow[];
  bill_users: BillUserRow[];
};

/** Local user record; `bills` is the set of bill ids this device knows about. */
export type UserData = UserRow & { bills: string[] };

/** Read a row's col_hlc as a typed map (it's `Json` on the generated Row type). */
export function colHlc(row: { col_hlc: unknown }): ColHlc {
  return (row.col_hlc as ColHlc | null) ?? {};
}

/**
 * Convert a server bill (PostgREST returns splits nested under items) into the
 * flat client snapshot — splits are pulled up to the bill level. Used when
 * ingesting `/api/bills/:id` and the (main) listing's cold-start data.
 */
export function flattenServerBill(
  raw: BillRow & {
    bill_contributors: ContributorRow[];
    bill_items: (ItemRow & { bill_item_splits?: SplitRow[] })[];
    bill_users: BillUserRow[];
  },
): BillData {
  const splits: SplitRow[] = [];
  const items: ItemRow[] = raw.bill_items.map(({ bill_item_splits, ...item }) => {
    if (bill_item_splits) splits.push(...bill_item_splits);
    return item;
  });
  return { ...raw, bill_items: items, bill_item_splits: splits };
}

/**
 * Shape the flat snapshot into the `allocate()` input (allocation spec §2):
 * real (non-stub) items, each with its real splits grouped by `item_id`.
 */
export function allocationInput(bill: BillData): {
  contributors: { id: string; name: string }[];
  items: {
    id: string;
    name: string;
    cost: number;
    contributor_id: string;
    splits: { contributor_id: string; ratio: number }[];
  }[];
} {
  // Keep ALL contributors in order (stubs included) so contribution indices align
  // with bill.bill_contributors everywhere in the UI; a stub just contributes 0.
  const contributors = bill.bill_contributors.map((c) => ({ id: c.id, name: c.name ?? "" }));
  const items = bill.bill_items
    .filter((i) => !i.is_stub && i.contributor_id !== null)
    .map((i) => ({
      id: i.id,
      name: i.name ?? "",
      cost: i.cost ?? 0,
      contributor_id: i.contributor_id as string,
      splits: bill.bill_item_splits
        .filter((s) => s.item_id === i.id && !s.is_stub && s.contributor_id !== null)
        .map((s) => ({ contributor_id: s.contributor_id as string, ratio: s.ratio })),
    }));
  return { contributors, items };
}
