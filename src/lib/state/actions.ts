/**
 * Mutation actions — the v2 client write-path (sync-engine spec §3). Each action:
 *   1. builds a validated mutation (`createMutation` stamps UUIDv7 + HLC, Zod-checks),
 *   2. applies it optimistically to the local snapshot via the convergence reducer,
 *   3. atomically persists the new snapshot + the mutation to the outbox (one IDB txn),
 *   4. enqueues it on the sync engine.
 * One DI style (spec §3.3): every action takes `app` explicitly (testable).
 */
import { goto } from "$app/navigation";
import type { MutationType } from "$lib/sync/mutations";
import { createMutation } from "$lib/sync/mutation";
import { uuidv7 } from "$lib/sync/uuid";
import type { AppState } from "./app.svelte";
import { type AnyMutation, applyUserMutation } from "./reduce";

/** Plain deep clone for IDB writes ($state.snapshot is a rune, unavailable in .ts). */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** A CREATE_BILL `bill` payload (matches the Zod schema in sync/mutations.ts). */
export interface NewBill {
  id: string;
  name: string;
  visibility: "private" | "public_read";
  bill_contributors: { id: string; name: string; sort: number }[];
  bill_items: {
    id: string;
    contributor_id: string;
    name: string;
    cost: number;
    sort: number;
    bill_item_splits: { id: string; item_id: string; contributor_id: string; ratio: number }[];
  }[];
}

/**
 * Shared local-commit path for a bill-scoped mutation: reduce → snapshot → outbox.
 * Returns false when there's no clock/user yet (not booted / signed out).
 */
async function commitBill(
  app: AppState,
  type: MutationType,
  billId: string,
  payload: unknown,
): Promise<boolean> {
  const userId = app.user.data?.id;
  if (!userId || !app.db) return false;

  const m = createMutation(app.clock, type, billId, userId, payload) as AnyMutation;
  app.bills.apply(billId, m);
  await app.db.commitMutation({ store: "bills", value: plain(app.bills.byId(billId)) }, m);
  app.sync?.enqueue(m);
  await app.persistClock();
  return true;
}

// ---- items ------------------------------------------------------------------
export const addItem = (
  app: AppState,
  billId: string,
  payload: {
    item: { id: string; contributor_id: string; name: string; cost: number; sort: number };
    splits: { id: string; item_id: string; contributor_id: string; ratio: number }[];
  },
) => commitBill(app, "ADD_ITEM", billId, payload);

export const updateItem = (
  app: AppState,
  billId: string,
  payload: { id: string } & Partial<{
    name: string;
    cost: number;
    contributor_id: string;
    sort: number;
  }>,
) => commitBill(app, "UPDATE_ITEM", billId, payload);

export const deleteItem = (app: AppState, billId: string, id: string) =>
  commitBill(app, "DELETE_ITEM", billId, { id });

// ---- contributors -----------------------------------------------------------
export const addContributor = (
  app: AppState,
  billId: string,
  payload: {
    contributor: { id: string; name: string; sort: number; linked_user_id?: string | null };
    splits: { id: string; item_id: string; contributor_id: string; ratio: number }[];
  },
) => commitBill(app, "ADD_CONTRIBUTOR", billId, payload);

export const updateContributor = (
  app: AppState,
  billId: string,
  payload: { id: string } & Partial<{ name: string; sort: number; linked_user_id: string }>,
) => commitBill(app, "UPDATE_CONTRIBUTOR", billId, payload);

export const deleteContributor = (
  app: AppState,
  billId: string,
  payload: { contributorId: string; reassignToId: string },
) => commitBill(app, "DELETE_CONTRIBUTOR", billId, payload);

// ---- splits -----------------------------------------------------------------
export const updateSplitRatio = (
  app: AppState,
  billId: string,
  payload: { id: string; ratio: number },
) => commitBill(app, "UPDATE_SPLIT", billId, payload);

// ---- bill header & membership ----------------------------------------------
export const updateBill = (
  app: AppState,
  billId: string,
  payload: Partial<{
    name: string;
    visibility: "private" | "public_read";
  }>,
) => commitBill(app, "UPDATE_BILL", billId, payload);

export const updateBillUser = (
  app: AppState,
  billId: string,
  payload: { userId: string } & Partial<{
    role: "owner" | "editor" | "viewer";
    payment_id: string | null;
    payment_method: "etransfer" | "payPal";
  }>,
) => commitBill(app, "UPDATE_BILL_USER", billId, payload);

// ---- user-scoped ------------------------------------------------------------
export async function updateUser(
  app: AppState,
  payload: Partial<{
    default_visibility: "private" | "public_read";
    default_payment_id: string | null;
    default_payment_method: "etransfer" | "payPal";
  }>,
): Promise<boolean> {
  const user = app.user.data;
  if (!user || !app.db) return false;

  const m = createMutation(app.clock, "UPDATE_USER", user.id, user.id, payload) as AnyMutation;
  applyUserMutation(user, m);
  await app.db.commitMutation({ store: "users", value: plain(user) }, m);
  app.sync?.enqueue(m);
  await app.persistClock();
  return true;
}

// ---- bill lifecycle (touch both the bill and the user's bill list) ----------
export async function deleteBill(app: AppState, billId: string): Promise<void> {
  const user = app.user.data;
  if (!user || !app.db) return;

  const m = createMutation(app.clock, "DELETE_BILL", billId, user.id, {
    member_ids: app.bills.byId(billId)?.bill_users.map((u) => u.user_id) ?? [],
  }) as AnyMutation;

  // Remove the bill snapshot + drop it from the user's list, then queue the delete.
  user.bills = user.bills.filter((id) => id !== billId);
  await app.user.persist();
  await app.bills.deleteLocal(billId);
  await app.db.commitMutation({ store: "bills", key: billId }, m);
  app.sync?.enqueue(m);
  await app.persistClock();

  goto("/");
}

export async function leaveBill(app: AppState, billId: string): Promise<void> {
  const user = app.user.data;
  if (!user || !app.db) return;

  const m = createMutation(app.clock, "DELETE_BILL_USER", billId, user.id, {
    userId: user.id,
  }) as AnyMutation;

  user.bills = user.bills.filter((id) => id !== billId);
  await app.user.persist();
  await app.bills.deleteLocal(billId);
  await app.db.commitMutation({ store: "bills", key: billId }, m);
  app.sync?.enqueue(m);
  await app.persistClock();

  goto("/");
}

/** Build a starter bill (caller supplies localized names). */
export function starterBill(
  userId: string,
  opts: {
    name: string;
    contributorName: (index: number) => string;
    itemName: (index: number) => string;
  },
): NewBill {
  const c2 = uuidv7();
  const item1 = uuidv7();
  const item2 = uuidv7();
  return {
    id: uuidv7(),
    name: opts.name,
    visibility: "private",
    bill_contributors: [
      { id: userId, name: opts.contributorName(1), sort: 0 },
      { id: c2, name: opts.contributorName(2), sort: 1 },
    ],
    bill_items: [
      {
        id: item1,
        contributor_id: userId,
        name: opts.itemName(1),
        cost: 0,
        sort: 0,
        bill_item_splits: [
          { id: uuidv7(), item_id: item1, contributor_id: userId, ratio: 1 },
          { id: uuidv7(), item_id: item1, contributor_id: c2, ratio: 1 },
        ],
      },
      {
        id: item2,
        contributor_id: c2,
        name: opts.itemName(2),
        cost: 0,
        sort: 1,
        bill_item_splits: [
          { id: uuidv7(), item_id: item2, contributor_id: userId, ratio: 1 },
          { id: uuidv7(), item_id: item2, contributor_id: c2, ratio: 1 },
        ],
      },
    ],
  };
}

export async function createBill(app: AppState, bill: NewBill): Promise<void> {
  const user = app.user.data;
  if (!user || !app.db) return;

  const m = createMutation(app.clock, "CREATE_BILL", bill.id, user.id, { bill }) as AnyMutation;
  app.bills.apply(bill.id, m);

  // Record the creator's owner membership locally (the server's sync_create_bill
  // records it too; this lets the UI reflect ownership immediately).
  const snap = app.bills.byId(bill.id);
  if (snap && !snap.bill_users.some((u) => u.user_id === user.id)) {
    snap.bill_users.push({
      bill_id: bill.id,
      user_id: user.id,
      role: "owner",
      payment_id: user.default_payment_id,
      payment_method: user.default_payment_method,
      hlc: m.hlc,
      col_hlc: {},
      updated_at: new Date().toISOString(),
    });
  }

  user.bills = [...user.bills, bill.id];
  await app.user.persist();
  await app.db.commitMutation({ store: "bills", value: plain(snap) }, m);
  app.sync?.enqueue(m);
  await app.persistClock();

  goto(`/bills/${bill.id}`);
}
