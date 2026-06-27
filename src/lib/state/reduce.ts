/**
 * Client-side convergence reducer — applies a mutation to a local snapshot with
 * **HLC per-column LWW**, mirroring the server `sync_*` RPCs (sync-engine spec §2/§6).
 * Used for both local optimistic writes and pulled peer mutations, so a stale
 * incoming edit can never regress a newer local field, and out-of-order children
 * heal against stub rows. Mutates the passed snapshot in place (the store owns a
 * single `$state` object) and is otherwise pure/deterministic.
 *
 * DELETE_BILL / DELETE_USER are record-level (remove the whole snapshot) and are
 * handled by the store, not here.
 */
import { decodeHLC } from "$lib/sync/hlc";
import type { Mutation, MutationType } from "$lib/sync/mutations";
import {
  type BillData,
  type ContributorRow,
  type ItemRow,
  type SplitRow,
  type UserData,
  colHlc,
} from "./model";

/** Proper discriminated union so `switch (m.type)` narrows `m.payload`. */
export type AnyMutation = { [T in MutationType]: Mutation<T> }[MutationType];

function isoFromHlc(hlc: string): string {
  return new Date(decodeHLC(hlc).wall).toISOString();
}

/** Set a column under per-column LWW: applies only if `hlc` beats the column's. */
function setField(
  row: { hlc: string; col_hlc: unknown; updated_at: string },
  field: string,
  value: unknown,
  hlc: string,
): void {
  const ch = colHlc(row);
  if (hlc > (ch[field] ?? "")) {
    (row as Record<string, unknown>)[field] = value;
    row.col_hlc = { ...ch, [field]: hlc };
    if (hlc > row.hlc) {
      row.hlc = hlc;
      row.updated_at = isoFromHlc(hlc);
    }
  }
}

// ---- stub constructors (col_hlc empty ⇒ any real write heals them) ----------
function stubContributor(billId: string, id: string): ContributorRow {
  return {
    bill_id: billId,
    id,
    name: "",
    sort: 0,
    linked_user_id: null,
    is_stub: true,
    hlc: "",
    col_hlc: {},
    updated_at: "",
  };
}
function stubItem(billId: string, id: string): ItemRow {
  return {
    bill_id: billId,
    id,
    name: "",
    cost: 0,
    sort: 0,
    contributor_id: null,
    is_stub: true,
    hlc: "",
    col_hlc: {},
    updated_at: "",
  };
}
function stubSplit(billId: string, id: string): SplitRow {
  return {
    bill_id: billId,
    id,
    item_id: null,
    contributor_id: null,
    ratio: 0,
    is_stub: true,
    hlc: "",
    col_hlc: {},
    updated_at: "",
  };
}

function upsertContributor(
  bill: BillData,
  id: string,
  hlc: string,
  fields: Partial<ContributorRow>,
  materialize: boolean,
): void {
  let row = bill.bill_contributors.find((c) => c.id === id);
  if (!row) {
    row = stubContributor(bill.id, id);
    bill.bill_contributors.push(row);
  }
  for (const [k, v] of Object.entries(fields)) setField(row, k, v, hlc);
  if (materialize) row.is_stub = false;
}

function upsertItem(
  bill: BillData,
  id: string,
  hlc: string,
  fields: Partial<ItemRow>,
  materialize: boolean,
): void {
  let row = bill.bill_items.find((i) => i.id === id);
  if (!row) {
    row = stubItem(bill.id, id);
    bill.bill_items.push(row);
  }
  for (const [k, v] of Object.entries(fields)) setField(row, k, v, hlc);
  if (materialize) row.is_stub = false;
}

function upsertSplit(
  bill: BillData,
  split: { id: string; item_id?: string; contributor_id?: string; ratio?: number },
  hlc: string,
  materialize: boolean,
): void {
  let row = bill.bill_item_splits.find((s) => s.id === split.id);
  if (!row) {
    row = stubSplit(bill.id, split.id);
    bill.bill_item_splits.push(row);
  }
  // Structural keys are filled once (coalesce), never overwritten.
  if (row.item_id == null && split.item_id != null) row.item_id = split.item_id;
  if (row.contributor_id == null && split.contributor_id != null) {
    row.contributor_id = split.contributor_id;
  }
  if (split.ratio !== undefined) setField(row, "ratio", split.ratio, hlc);
  if (hlc > row.hlc) {
    row.hlc = hlc;
    row.updated_at = isoFromHlc(hlc);
  }
  if (materialize) row.is_stub = false;
}

/** Apply a bill-scoped mutation to its snapshot in place. */
export function applyBillMutation(bill: BillData, m: AnyMutation): void {
  switch (m.type) {
    case "CREATE_BILL": {
      const b = m.payload.bill;
      setField(bill, "name", b.name, m.hlc);
      setField(bill, "visibility", b.visibility, m.hlc);
      bill.is_stub = false;
      for (const c of b.bill_contributors) {
        upsertContributor(
          bill,
          c.id,
          m.hlc,
          { name: c.name, sort: c.sort, linked_user_id: c.linked_user_id ?? null },
          true,
        );
      }
      for (const it of b.bill_items) {
        upsertItem(
          bill,
          it.id,
          m.hlc,
          { name: it.name, cost: it.cost, sort: it.sort, contributor_id: it.contributor_id },
          true,
        );
        for (const s of it.bill_item_splits) upsertSplit(bill, s, m.hlc, true);
      }
      break;
    }
    case "SNAPSHOT": {
      // Compaction (sync spec §8): the snapshot is the authoritative full state at
      // its (max) HLC — replace local state wholesale, then re-fill at that HLC.
      const b = m.payload.bill;
      bill.bill_contributors = [];
      bill.bill_items = [];
      bill.bill_item_splits = [];
      bill.bill_users = [];
      bill.col_hlc = {};
      bill.hlc = "";
      setField(bill, "name", b.name, m.hlc);
      setField(bill, "visibility", b.visibility, m.hlc);
      bill.is_stub = false;
      for (const c of b.bill_contributors) {
        upsertContributor(
          bill,
          c.id,
          m.hlc,
          { name: c.name, sort: c.sort, linked_user_id: c.linked_user_id ?? null },
          true,
        );
      }
      for (const it of b.bill_items) {
        upsertItem(
          bill,
          it.id,
          m.hlc,
          { name: it.name, cost: it.cost, sort: it.sort, contributor_id: it.contributor_id },
          true,
        );
        for (const s of it.bill_item_splits) upsertSplit(bill, s, m.hlc, true);
      }
      for (const u of b.bill_users) {
        bill.bill_users.push({
          bill_id: bill.id,
          user_id: u.user_id,
          role: u.role,
          payment_id: u.payment_id ?? null,
          payment_method: u.payment_method ?? null,
          hlc: m.hlc,
          col_hlc: { role: m.hlc },
          updated_at: isoFromHlc(m.hlc),
        });
      }
      break;
    }
    case "UPDATE_BILL": {
      for (const [k, v] of Object.entries(m.payload)) setField(bill, k, v, m.hlc);
      break;
    }
    case "ADD_CONTRIBUTOR": {
      const c = m.payload.contributor;
      upsertContributor(
        bill,
        c.id,
        m.hlc,
        { name: c.name, sort: c.sort, linked_user_id: c.linked_user_id ?? null },
        true,
      );
      for (const s of m.payload.splits) upsertSplit(bill, s, m.hlc, true);
      break;
    }
    case "UPDATE_CONTRIBUTOR": {
      const { id, ...fields } = m.payload;
      upsertContributor(bill, id, m.hlc, fields, false);
      break;
    }
    case "DELETE_CONTRIBUTOR": {
      const { contributorId, reassignToId } = m.payload;
      bill.bill_contributors = bill.bill_contributors.filter((c) => c.id !== contributorId);
      for (const it of bill.bill_items) {
        if (it.contributor_id === contributorId) it.contributor_id = reassignToId;
      }
      bill.bill_item_splits = bill.bill_item_splits.filter(
        (s) => s.contributor_id !== contributorId,
      );
      break;
    }
    case "ADD_ITEM": {
      const it = m.payload.item;
      upsertItem(
        bill,
        it.id,
        m.hlc,
        { name: it.name, cost: it.cost, sort: it.sort, contributor_id: it.contributor_id },
        true,
      );
      for (const s of m.payload.splits) upsertSplit(bill, s, m.hlc, true);
      break;
    }
    case "UPDATE_ITEM": {
      const { id, ...fields } = m.payload;
      upsertItem(bill, id, m.hlc, fields, false);
      break;
    }
    case "DELETE_ITEM": {
      bill.bill_items = bill.bill_items.filter((i) => i.id !== m.payload.id);
      bill.bill_item_splits = bill.bill_item_splits.filter((s) => s.item_id !== m.payload.id);
      break;
    }
    case "ADD_SPLIT": {
      upsertSplit(bill, m.payload, m.hlc, true);
      break;
    }
    case "UPDATE_SPLIT": {
      upsertSplit(bill, { id: m.payload.id, ratio: m.payload.ratio }, m.hlc, false);
      break;
    }
    case "UPDATE_BILL_USER": {
      const { userId, ...fields } = m.payload;
      let row = bill.bill_users.find((u) => u.user_id === userId);
      if (!row) {
        row = {
          bill_id: bill.id,
          user_id: userId,
          role: "viewer",
          payment_id: null,
          payment_method: null,
          hlc: "",
          col_hlc: {},
          updated_at: "",
        };
        bill.bill_users.push(row);
      }
      for (const [k, v] of Object.entries(fields)) setField(row, k, v, m.hlc);
      break;
    }
    case "DELETE_BILL_USER": {
      bill.bill_users = bill.bill_users.filter((u) => u.user_id !== m.payload.userId);
      break;
    }
    // Record-level deletes / user-scoped mutations are not snapshot edits.
    case "DELETE_BILL":
    case "UPDATE_USER":
    case "DELETE_USER":
      break;
  }
}

/** Apply a user-scoped mutation (UPDATE_USER) to the local user record in place. */
export function applyUserMutation(user: UserData, m: AnyMutation): void {
  if (m.type !== "UPDATE_USER") return;
  for (const [k, v] of Object.entries(m.payload)) setField(user, k, v, m.hlc);
}
