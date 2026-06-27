import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/navigation", () => ({ goto: vi.fn() }));

import { HLCClock } from "$lib/sync/clock";
import { SyncDB } from "$lib/sync/db";
import type { Mutation } from "$lib/sync/mutations";
import { type AppState, BillState, UserState } from "./app.svelte";
import { addItem, createBill, starterBill, updateItem, updateUser } from "./actions";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BILL = U(500);

let counter = 0;
async function makeApp(userId = U(1)) {
  const db = (await SyncDB.open(`actions-test-${counter++}`))!;
  const clock = new HLCClock("node-a");
  const user = new UserState(db);
  await user.hydrate(userId);
  const bills = new BillState(db, fetch);
  const sync = { enqueue: vi.fn() };
  const app = {
    user,
    bills,
    clock,
    db,
    sync,
    persistClock: async () => {},
  } as unknown as AppState;
  return { app, db, sync };
}

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  contributor_id: U(1),
  name: "Coffee",
  cost: 500,
  sort: 0,
  ...over,
});

describe("actions write-path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("addItem reduces locally, persists the snapshot + outbox, and enqueues", async () => {
    const { app, db, sync } = await makeApp();
    await addItem(app, BILL, {
      item: item(U(10)),
      splits: [{ id: U(20), item_id: U(10), contributor_id: U(1), ratio: 1 }],
    });

    // local snapshot updated (single source of truth)
    expect(app.bills.byId(BILL)?.bill_items).toHaveLength(1);
    expect(app.bills.byId(BILL)?.bill_item_splits).toHaveLength(1);
    // enqueued for sync
    expect(sync.enqueue).toHaveBeenCalledTimes(1);
    // durably persisted: outbox + snapshot in IDB
    const outbox = await db.loadOutbox();
    expect(outbox.map((m: Mutation) => m.type)).toEqual(["ADD_ITEM"]);
    const stored = await db.get<{ bill_items: unknown[] }>("bills", BILL);
    expect(stored?.bill_items).toHaveLength(1);
  });

  it("two updateItem calls converge by HLC (later wins), each queued", async () => {
    const { app, db, sync } = await makeApp();
    await addItem(app, BILL, { item: item(U(10), { name: "A" }), splits: [] });
    await updateItem(app, BILL, { id: U(10), name: "B" });
    await updateItem(app, BILL, { id: U(10), name: "C" });

    expect(app.bills.byId(BILL)?.bill_items[0].name).toBe("C");
    expect(sync.enqueue).toHaveBeenCalledTimes(3);
    expect((await db.loadOutbox()).length).toBe(3);
  });

  it("createBill seeds a bill, records owner membership, and adds it to the user", async () => {
    const { app, db } = await makeApp();
    const bill = starterBill(U(1), {
      name: "Dinner",
      contributorName: (i) => `Person ${i}`,
      itemName: (i) => `Item ${i}`,
    });
    await createBill(app, bill);

    const snap = app.bills.byId(bill.id);
    expect(snap?.name).toBe("Dinner");
    expect(snap?.bill_contributors).toHaveLength(2);
    expect(snap?.bill_users.find((u) => u.user_id === U(1))?.role).toBe("owner");
    expect(app.user.data?.bills).toContain(bill.id);
    expect((await db.loadOutbox()).map((m: Mutation) => m.type)).toEqual(["CREATE_BILL"]);
  });

  it("updateUser applies + persists + enqueues a UPDATE_USER", async () => {
    const { app, db, sync } = await makeApp();
    await updateUser(app, { default_payment_id: "me@example.com" });
    expect(app.user.data?.default_payment_id).toBe("me@example.com");
    expect(sync.enqueue).toHaveBeenCalledTimes(1);
    expect((await db.loadOutbox()).map((m: Mutation) => m.type)).toEqual(["UPDATE_USER"]);
  });
});
