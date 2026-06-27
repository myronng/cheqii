/**
 * v2 client-side model types: the denormalized snapshots the UI reads (one record
 * per cheque, never a join) and the local user record. Derived from the generated
 * Supabase Row types so they stay aligned to the live schema (data-model spec).
 *
 * Every domain row carries `hlc` + `col_hlc` (a {column: hlc} map), mirroring the
 * server, so the client reducer can do per-column LWW and never regress a newer
 * local edit when applying a peer's pulled mutation. See docs/sync-engine-spec.md §2.
 */
import type { Database } from "$lib/utils/models/database";

type Tables = Database["public"]["Tables"];

export type ChequeRow = Tables["cheques"]["Row"];
export type ContributorRow = Tables["cheque_contributors"]["Row"];
export type ItemRow = Tables["cheque_items"]["Row"];
export type SplitRow = Tables["cheque_item_splits"]["Row"];
export type ChequeUserRow = Tables["cheque_users"]["Row"];
export type UserRow = Tables["users"]["Row"];

/** Per-column HLC map: `{ columnName: hlc }`. Stored as jsonb (`Json`) on the row. */
export type ColHlc = Record<string, string>;

/**
 * The cheque snapshot — the UI source of truth. Mirrors the DB tables **flat**
 * (splits are NOT nested under items): a `UPDATE_SPLIT {id, ratio}` can arrive
 * before its item, so splits must be placeable without a known parent (matching
 * the server's nullable `item_id` + stub-healing). `itemSplits()` regroups them
 * for the allocate lib at render time.
 */
export type ChequeData = ChequeRow & {
  cheque_contributors: ContributorRow[];
  cheque_items: ItemRow[];
  cheque_item_splits: SplitRow[];
  cheque_users: ChequeUserRow[];
};

/** Local user record; `cheques` is the set of cheque ids this device knows about. */
export type UserData = UserRow & { cheques: string[] };

/** Read a row's col_hlc as a typed map (it's `Json` on the generated Row type). */
export function colHlc(row: { col_hlc: unknown }): ColHlc {
  return (row.col_hlc as ColHlc | null) ?? {};
}

/**
 * Convert a server cheque (PostgREST returns splits nested under items) into the
 * flat client snapshot — splits are pulled up to the cheque level. Used when
 * ingesting `/api/cheques/:id` and the (main) listing's cold-start data.
 */
export function flattenServerCheque(
  raw: ChequeRow & {
    cheque_contributors: ContributorRow[];
    cheque_items: (ItemRow & { cheque_item_splits?: SplitRow[] })[];
    cheque_users: ChequeUserRow[];
  },
): ChequeData {
  const splits: SplitRow[] = [];
  const items: ItemRow[] = raw.cheque_items.map(({ cheque_item_splits, ...item }) => {
    if (cheque_item_splits) splits.push(...cheque_item_splits);
    return item;
  });
  return { ...raw, cheque_items: items, cheque_item_splits: splits };
}

/**
 * Shape the flat snapshot into the `allocate()` input (allocation spec §2):
 * real (non-stub) items, each with its real splits grouped by `item_id`.
 */
export function allocationInput(cheque: ChequeData): {
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
  // with cheque.cheque_contributors everywhere in the UI; a stub just contributes 0.
  const contributors = cheque.cheque_contributors.map((c) => ({ id: c.id, name: c.name ?? "" }));
  const items = cheque.cheque_items
    .filter((i) => !i.is_stub && i.contributor_id !== null)
    .map((i) => ({
      id: i.id,
      name: i.name ?? "",
      cost: i.cost ?? 0,
      contributor_id: i.contributor_id as string,
      splits: cheque.cheque_item_splits
        .filter((s) => s.item_id === i.id && !s.is_stub && s.contributor_id !== null)
        .map((s) => ({ contributor_id: s.contributor_id as string, ratio: s.ratio })),
    }));
  return { contributors, items };
}
