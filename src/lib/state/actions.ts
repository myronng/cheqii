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
import { signInAnonymously } from "$lib/utils/common/auth.svelte";
import { DATE_FORMATTER } from "$lib/utils/common/formatter";
import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppState } from "./app.svelte";
import { type AnyMutation, applyUserMutation } from "./reduce";

/** Plain deep clone for IDB writes ($state.snapshot is a rune, unavailable in .ts). */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** A CREATE_CHEQUE `cheque` payload (matches the Zod schema in sync/mutations.ts). */
export interface NewCheque {
  id: string;
  name: string;
  visibility: "private" | "public_read";
  cheque_people: { id: string; name: string; sort: number }[];
  cheque_items: {
    id: string;
    person_id: string;
    name: string;
    cost: number;
    sort: number;
    cheque_item_splits: { id: string; item_id: string; person_id: string; ratio: number }[];
  }[];
}

/**
 * Shared local-commit path for a cheque-scoped mutation: reduce → snapshot → outbox.
 * Returns false when there's no clock/user yet (not booted / signed out).
 */
async function commitCheque(
  app: AppState,
  type: MutationType,
  chequeId: string,
  payload: unknown,
): Promise<boolean> {
  const userId = app.user.data?.id;
  if (!userId || !app.db) return false;

  const m = createMutation(app.clock, type, chequeId, userId, payload) as AnyMutation;
  app.cheques.apply(chequeId, m);
  await app.db.commitMutation({ store: "cheques", value: plain(app.cheques.byId(chequeId)) }, m);
  app.sync?.enqueue(m);
  await app.persistClock();
  return true;
}

// ---- items ------------------------------------------------------------------
export const addItem = (
  app: AppState,
  chequeId: string,
  payload: {
    item: { id: string; person_id: string; name: string; cost: number; sort: number };
    splits: { id: string; item_id: string; person_id: string; ratio: number }[];
  },
) => commitCheque(app, "ADD_ITEM", chequeId, payload);

export const updateItem = (
  app: AppState,
  chequeId: string,
  payload: { id: string } & Partial<{
    name: string;
    cost: number;
    person_id: string;
    sort: number;
  }>,
) => commitCheque(app, "UPDATE_ITEM", chequeId, payload);

export const deleteItem = (app: AppState, chequeId: string, id: string) =>
  commitCheque(app, "DELETE_ITEM", chequeId, { id });

// ---- people -----------------------------------------------------------
export const addPerson = (
  app: AppState,
  chequeId: string,
  payload: {
    person: { id: string; name: string; sort: number; linked_user_id?: string | null };
    splits: { id: string; item_id: string; person_id: string; ratio: number }[];
  },
) => commitCheque(app, "ADD_PERSON", chequeId, payload);

export const updatePerson = (
  app: AppState,
  chequeId: string,
  payload: { id: string } & Partial<{ name: string; sort: number; linked_user_id: string | null }>,
) => commitCheque(app, "UPDATE_PERSON", chequeId, payload);

export const deletePerson = (
  app: AppState,
  chequeId: string,
  payload: { personId: string; reassignToId: string },
) => commitCheque(app, "DELETE_PERSON", chequeId, payload);

// ---- splits -----------------------------------------------------------------
export const updateSplitRatio = (
  app: AppState,
  chequeId: string,
  payload: { id: string; ratio: number },
) => commitCheque(app, "UPDATE_SPLIT", chequeId, payload);

// ---- cheque header & membership ----------------------------------------------
export const updateCheque = (
  app: AppState,
  chequeId: string,
  payload: Partial<{
    name: string;
    visibility: "private" | "public_read";
  }>,
) => commitCheque(app, "UPDATE_CHEQUE", chequeId, payload);

export const updateChequeUser = (
  app: AppState,
  chequeId: string,
  payload: { userId: string } & Partial<{
    role: "owner" | "editor" | "viewer";
    payment_id: string | null;
    payment_method: "etransfer" | "payPal";
    claim_dismissed: boolean;
  }>,
) => commitCheque(app, "UPDATE_CHEQUE_USER", chequeId, payload);

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

// ---- cheque lifecycle (touch both the cheque and the user's cheque list) ----------
export async function deleteCheque(app: AppState, chequeId: string): Promise<void> {
  const user = app.user.data;
  if (!user || !app.db) return;

  const m = createMutation(app.clock, "DELETE_CHEQUE", chequeId, user.id, {
    member_ids: app.cheques.byId(chequeId)?.cheque_users.map((u) => u.user_id) ?? [],
  }) as AnyMutation;

  // Remove the cheque snapshot + drop it from the user's list, then queue the delete.
  user.cheques = user.cheques.filter((id) => id !== chequeId);
  await app.user.persist();
  await app.cheques.deleteLocal(chequeId);
  await app.db.commitMutation({ store: "cheques", key: chequeId }, m);
  app.sync?.enqueue(m);
  await app.persistClock();

  goto("/cheques");
}

export async function leaveCheque(app: AppState, chequeId: string): Promise<void> {
  const user = app.user.data;
  if (!user || !app.db) return;

  const m = createMutation(app.clock, "DELETE_CHEQUE_USER", chequeId, user.id, {
    userId: user.id,
  }) as AnyMutation;

  user.cheques = user.cheques.filter((id) => id !== chequeId);
  await app.user.persist();
  await app.cheques.deleteLocal(chequeId);
  await app.db.commitMutation({ store: "cheques", key: chequeId }, m);
  app.sync?.enqueue(m);
  await app.persistClock();

  goto("/cheques");
}

/** Build a starter cheque (caller supplies localized names). */
export function starterCheque(
  userId: string,
  opts: {
    name: string;
    personName: (index: number) => string;
    itemName: (index: number) => string;
  },
): NewCheque {
  const c2 = uuidv7();
  const item1 = uuidv7();
  const item2 = uuidv7();
  return {
    id: uuidv7(),
    name: opts.name,
    visibility: "private",
    cheque_people: [
      { id: userId, name: opts.personName(1), sort: 0 },
      { id: c2, name: opts.personName(2), sort: 1 },
    ],
    cheque_items: [
      {
        id: item1,
        person_id: userId,
        name: opts.itemName(1),
        cost: 0,
        sort: 0,
        cheque_item_splits: [
          { id: uuidv7(), item_id: item1, person_id: userId, ratio: 1 },
          { id: uuidv7(), item_id: item1, person_id: c2, ratio: 1 },
        ],
      },
      {
        id: item2,
        person_id: c2,
        name: opts.itemName(2),
        cost: 0,
        sort: 1,
        cheque_item_splits: [
          { id: uuidv7(), item_id: item2, person_id: userId, ratio: 1 },
          { id: uuidv7(), item_id: item2, person_id: c2, ratio: 1 },
        ],
      },
    ],
  };
}

export async function createCheque(app: AppState, cheque: NewCheque): Promise<void> {
  const user = app.user.data;
  if (!user || !app.db) return;

  const m = createMutation(app.clock, "CREATE_CHEQUE", cheque.id, user.id, {
    cheque,
  }) as AnyMutation;
  app.cheques.apply(cheque.id, m);

  // Record the creator's owner membership locally (the server's sync_create_cheque
  // records it too; this lets the UI reflect ownership immediately).
  const snap = app.cheques.byId(cheque.id);
  if (snap && !snap.cheque_users.some((u) => u.user_id === user.id)) {
    snap.cheque_users.push({
      cheque_id: cheque.id,
      user_id: user.id,
      role: "owner",
      payment_id: user.default_payment_id,
      payment_method: user.default_payment_method,
      claim_dismissed: false,
      hlc: m.hlc,
      col_hlc: {},
      updated_at: new Date().toISOString(),
    });
  }

  user.cheques = [...user.cheques, cheque.id];
  await app.user.persist();
  await app.db.commitMutation({ store: "cheques", value: plain(snap) }, m);
  app.sync?.enqueue(m);
  await app.persistClock();

  goto(`/cheques/${cheque.id}`);
}

/**
 * End-to-end "new cheque" flow shared by the header button and the `/new` route
 * (the landing's "Start A Cheque" CTA lands here): ensure an identity (the
 * signed-in user if present, else an anonymous sign-in), build a localized
 * starter cheque, and commit it (which navigates to `/cheques/[id]`).
 */
// In-flight guard: the /new route kicks this off from an effect, and anon sign-in
// briefly churns auth state — without this, a second call could land before the
// first navigates and create a duplicate cheque.
let creatingCheque = false;

export async function createNewCheque(
  app: AppState,
  supabase: SupabaseClient,
  strings: LocalizedStrings,
): Promise<void> {
  if (creatingCheque) return;
  creatingCheque = true;
  try {
    // First action that needs an identity: sign in anonymously, then resolve.
    if (!app.user.data) {
      await signInAnonymously(supabase);
      await app.resolveIdentity();
    }
    const user = app.user.data;
    if (!user) return;

    const cheque = starterCheque(user.id, {
      name: interpolateString(strings["cheque{date}"], {
        date: DATE_FORMATTER.format(new Date()),
      }),
      personName: (index) => interpolateString(strings["person{index}"], { index: String(index) }),
      itemName: (index) => interpolateString(strings["item{index}"], { index: String(index) }),
    });
    await createCheque(app, cheque);
  } finally {
    creatingCheque = false;
  }
}
