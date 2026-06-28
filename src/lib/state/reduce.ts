/**
 * Client-side convergence reducer — applies a mutation to a local snapshot with
 * **HLC per-column LWW**, mirroring the server `sync_*` RPCs (sync-engine spec §2/§6).
 * Used for both local optimistic writes and pulled peer mutations, so a stale
 * incoming edit can never regress a newer local field, and out-of-order children
 * heal against stub rows. Mutates the passed snapshot in place (the store owns a
 * single `$state` object) and is otherwise pure/deterministic.
 *
 * DELETE_CHEQUE / DELETE_USER are record-level (remove the whole snapshot) and are
 * handled by the store, not here.
 */
import { decodeHLC } from "$lib/sync/hlc";
import type { Mutation, MutationType } from "$lib/sync/mutations";
import {
  type ChequeData,
  type PersonRow,
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
function stubPerson(chequeId: string, id: string): PersonRow {
  return {
    cheque_id: chequeId,
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
function stubItem(chequeId: string, id: string): ItemRow {
  return {
    cheque_id: chequeId,
    id,
    name: "",
    cost: 0,
    sort: 0,
    person_id: null,
    is_stub: true,
    hlc: "",
    col_hlc: {},
    updated_at: "",
  };
}
function stubSplit(chequeId: string, id: string): SplitRow {
  return {
    cheque_id: chequeId,
    id,
    item_id: null,
    person_id: null,
    ratio: 0,
    is_stub: true,
    hlc: "",
    col_hlc: {},
    updated_at: "",
  };
}

function upsertPerson(
  cheque: ChequeData,
  id: string,
  hlc: string,
  fields: Partial<PersonRow>,
  materialize: boolean,
): void {
  let row = cheque.cheque_people.find((c) => c.id === id);
  if (!row) {
    row = stubPerson(cheque.id, id);
    cheque.cheque_people.push(row);
  }
  for (const [k, v] of Object.entries(fields)) setField(row, k, v, hlc);
  if (materialize) row.is_stub = false;
}

function upsertItem(
  cheque: ChequeData,
  id: string,
  hlc: string,
  fields: Partial<ItemRow>,
  materialize: boolean,
): void {
  let row = cheque.cheque_items.find((i) => i.id === id);
  if (!row) {
    row = stubItem(cheque.id, id);
    cheque.cheque_items.push(row);
  }
  for (const [k, v] of Object.entries(fields)) setField(row, k, v, hlc);
  if (materialize) row.is_stub = false;
}

function upsertSplit(
  cheque: ChequeData,
  split: { id: string; item_id?: string; person_id?: string; ratio?: number },
  hlc: string,
  materialize: boolean,
): void {
  let row = cheque.cheque_item_splits.find((s) => s.id === split.id);
  if (!row) {
    row = stubSplit(cheque.id, split.id);
    cheque.cheque_item_splits.push(row);
  }
  // Structural keys are filled once (coalesce), never overwritten.
  if (row.item_id == null && split.item_id != null) row.item_id = split.item_id;
  if (row.person_id == null && split.person_id != null) {
    row.person_id = split.person_id;
  }
  if (split.ratio !== undefined) setField(row, "ratio", split.ratio, hlc);
  if (hlc > row.hlc) {
    row.hlc = hlc;
    row.updated_at = isoFromHlc(hlc);
  }
  if (materialize) row.is_stub = false;
}

/** Apply a cheque-scoped mutation to its snapshot in place. */
export function applyChequeMutation(cheque: ChequeData, m: AnyMutation): void {
  switch (m.type) {
    case "CREATE_CHEQUE": {
      const b = m.payload.cheque;
      setField(cheque, "name", b.name, m.hlc);
      setField(cheque, "visibility", b.visibility, m.hlc);
      cheque.is_stub = false;
      for (const c of b.cheque_people) {
        upsertPerson(
          cheque,
          c.id,
          m.hlc,
          { name: c.name, sort: c.sort, linked_user_id: c.linked_user_id ?? null },
          true,
        );
      }
      for (const it of b.cheque_items) {
        upsertItem(
          cheque,
          it.id,
          m.hlc,
          { name: it.name, cost: it.cost, sort: it.sort, person_id: it.person_id },
          true,
        );
        for (const s of it.cheque_item_splits) upsertSplit(cheque, s, m.hlc, true);
      }
      break;
    }
    case "SNAPSHOT": {
      // Compaction (sync spec §8): the snapshot is the authoritative full state at
      // its (max) HLC — replace local state wholesale, then re-fill at that HLC.
      const b = m.payload.cheque;
      cheque.cheque_people = [];
      cheque.cheque_items = [];
      cheque.cheque_item_splits = [];
      cheque.cheque_users = [];
      cheque.col_hlc = {};
      cheque.hlc = "";
      setField(cheque, "name", b.name, m.hlc);
      setField(cheque, "visibility", b.visibility, m.hlc);
      cheque.is_stub = false;
      for (const c of b.cheque_people) {
        upsertPerson(
          cheque,
          c.id,
          m.hlc,
          { name: c.name, sort: c.sort, linked_user_id: c.linked_user_id ?? null },
          true,
        );
      }
      for (const it of b.cheque_items) {
        upsertItem(
          cheque,
          it.id,
          m.hlc,
          { name: it.name, cost: it.cost, sort: it.sort, person_id: it.person_id },
          true,
        );
        for (const s of it.cheque_item_splits) upsertSplit(cheque, s, m.hlc, true);
      }
      for (const u of b.cheque_users) {
        cheque.cheque_users.push({
          cheque_id: cheque.id,
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
    case "UPDATE_CHEQUE": {
      for (const [k, v] of Object.entries(m.payload)) setField(cheque, k, v, m.hlc);
      break;
    }
    case "ADD_PERSON": {
      const c = m.payload.person;
      upsertPerson(
        cheque,
        c.id,
        m.hlc,
        { name: c.name, sort: c.sort, linked_user_id: c.linked_user_id ?? null },
        true,
      );
      for (const s of m.payload.splits) upsertSplit(cheque, s, m.hlc, true);
      break;
    }
    case "UPDATE_PERSON": {
      const { id, ...fields } = m.payload;
      upsertPerson(cheque, id, m.hlc, fields, false);
      break;
    }
    case "DELETE_PERSON": {
      const { personId, reassignToId } = m.payload;
      cheque.cheque_people = cheque.cheque_people.filter((c) => c.id !== personId);
      for (const it of cheque.cheque_items) {
        if (it.person_id === personId) it.person_id = reassignToId;
      }
      cheque.cheque_item_splits = cheque.cheque_item_splits.filter((s) => s.person_id !== personId);
      break;
    }
    case "ADD_ITEM": {
      const it = m.payload.item;
      upsertItem(
        cheque,
        it.id,
        m.hlc,
        { name: it.name, cost: it.cost, sort: it.sort, person_id: it.person_id },
        true,
      );
      for (const s of m.payload.splits) upsertSplit(cheque, s, m.hlc, true);
      break;
    }
    case "UPDATE_ITEM": {
      const { id, ...fields } = m.payload;
      upsertItem(cheque, id, m.hlc, fields, false);
      break;
    }
    case "DELETE_ITEM": {
      cheque.cheque_items = cheque.cheque_items.filter((i) => i.id !== m.payload.id);
      cheque.cheque_item_splits = cheque.cheque_item_splits.filter(
        (s) => s.item_id !== m.payload.id,
      );
      break;
    }
    case "ADD_SPLIT": {
      upsertSplit(cheque, m.payload, m.hlc, true);
      break;
    }
    case "UPDATE_SPLIT": {
      upsertSplit(cheque, { id: m.payload.id, ratio: m.payload.ratio }, m.hlc, false);
      break;
    }
    case "UPDATE_CHEQUE_USER": {
      const { userId, ...fields } = m.payload;
      let row = cheque.cheque_users.find((u) => u.user_id === userId);
      if (!row) {
        row = {
          cheque_id: cheque.id,
          user_id: userId,
          role: "viewer",
          payment_id: null,
          payment_method: null,
          hlc: "",
          col_hlc: {},
          updated_at: "",
        };
        cheque.cheque_users.push(row);
      }
      for (const [k, v] of Object.entries(fields)) setField(row, k, v, m.hlc);
      break;
    }
    case "DELETE_CHEQUE_USER": {
      cheque.cheque_users = cheque.cheque_users.filter((u) => u.user_id !== m.payload.userId);
      break;
    }
    // Record-level deletes / user-scoped mutations are not snapshot edits.
    case "DELETE_CHEQUE":
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
