/**
 * v2 client-side model types: the denormalized snapshots the UI reads (one record
 * per cheque, never a join) and the local user record. Derived from the generated
 * Supabase Row types so they stay aligned to the live schema (data-model spec).
 *
 * Every domain row carries `hlc` + `col_hlc` (a {column: hlc} map), mirroring the
 * server, so the client reducer can do per-column LWW and never regress a newer
 * local edit when applying a peer's pulled mutation. See docs/sync-engine-spec.md §2.
 */
import { allocate } from "$lib/domain/allocate";
import type { Database } from "$lib/utils/models/database";

type Tables = Database["public"]["Tables"];

export type ChequeRow = Tables["cheques"]["Row"];
export type PersonRow = Tables["cheque_people"]["Row"];
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
  cheque_people: PersonRow[];
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
    cheque_people: PersonRow[];
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
  people: { id: string; name: string }[];
  items: {
    id: string;
    name: string;
    cost: number;
    person_id: string;
    splits: { person_id: string; ratio: number }[];
  }[];
} {
  // Keep ALL people in order (stubs included) so contribution indices align
  // with cheque.cheque_people everywhere in the UI; a stub just contributes 0.
  const people = cheque.cheque_people.map((c) => ({ id: c.id, name: c.name ?? "" }));
  const items = cheque.cheque_items
    .filter((i) => !i.is_stub && i.person_id !== null)
    .map((i) => ({
      id: i.id,
      name: i.name ?? "",
      cost: i.cost ?? 0,
      person_id: i.person_id as string,
      splits: cheque.cheque_item_splits
        .filter((s) => s.item_id === i.id && !s.is_stub && s.person_id !== null)
        .map((s) => ({ person_id: s.person_id as string, ratio: s.ratio })),
    }));
  return { people, items };
}

/**
 * The signed-in user's standing on a cheque, for the listing card. "unlinked"
 * means they're a member but not yet tied to a person (e.g. joined via
 * invite — see EntryPayments' claim flow); otherwise their net is paid − owing
 * (zero folds into "owed", shown as +0.00). All derived from the snapshot via the
 * pure allocate() — no extra fetch. `amount` is a non-negative minor-unit value.
 */
export type ChequeBalance = { state: "unlinked" } | { state: "owed" | "owe"; amount: number };

export interface ChequeSummary {
  /** Σ of non-stub item costs (minor units). */
  total: number;
  balance: ChequeBalance;
}

export function chequeSummary(cheque: ChequeData, userId: string): ChequeSummary {
  const input = allocationInput(cheque);
  const { grandTotal, contributions } = allocate(input.people, input.items);

  const myIndex = cheque.cheque_people.findIndex(
    (c) => !c.is_stub && (c.id === userId || c.linked_user_id === userId),
  );
  if (myIndex < 0) return { total: grandTotal, balance: { state: "unlinked" } };

  const c = contributions.get(myIndex);
  const net = (c?.paid.total ?? 0) - (c?.owing.total ?? 0);
  return {
    total: grandTotal,
    balance: net < 0 ? { state: "owe", amount: -net } : { state: "owed", amount: net },
  };
}
