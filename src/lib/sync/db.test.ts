import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { DB_VERSION, SyncDB } from "./db";
import type { Mutation } from "./mutations";

const BILL = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";

let dbCounter = 0;
function freshDb() {
  // Unique name per test so fake-indexeddb instances don't share state.
  return SyncDB.open(`cheqii-test-${dbCounter++}`);
}

function mutation(id: string, overrides: Partial<Mutation> = {}): Mutation {
  return {
    id,
    type: "UPDATE_BILL",
    entity_id: BILL,
    user_id: USER,
    hlc: "000000000001000:00000:dev",
    payload: { name: "x" },
    ...overrides,
  } as Mutation;
}

describe("SyncDB", () => {
  let db: SyncDB;
  beforeEach(async () => {
    const opened = await freshDb();
    expect(opened).not.toBeNull();
    db = opened as SyncDB;
  });

  it("derives the schema version from the migration list", () => {
    expect(DB_VERSION).toBe(3);
  });

  it("commitMutation writes the snapshot and outboxes the mutation atomically", async () => {
    const snapshot = { id: BILL, name: "Dinner" };
    await db.commitMutation({ store: "bills", value: snapshot }, mutation("m1"));

    expect(await db.get("bills", BILL)).toEqual(snapshot);
    const outbox = await db.loadOutbox();
    expect(outbox.map((m) => m.id)).toEqual(["m1"]);
  });

  it("commitMutation can delete a snapshot while still logging the mutation", async () => {
    await db.put("bills", { id: BILL, name: "Dinner" });
    await db.commitMutation(
      { store: "bills", key: BILL },
      mutation("m2", { type: "DELETE_BILL", payload: { member_ids: [] } }),
    );
    expect(await db.get("bills", BILL)).toBeUndefined();
    expect((await db.loadOutbox()).map((m) => m.id)).toEqual(["m2"]);
  });

  it("clearOutbox removes only the flushed ids", async () => {
    await db.commitMutation({ store: "bills", value: { id: BILL } }, mutation("a"));
    await db.commitMutation({ store: "bills", value: { id: BILL } }, mutation("b"));
    await db.commitMutation({ store: "bills", value: { id: BILL } }, mutation("c"));
    await db.clearOutbox(["a", "c"]);
    expect((await db.loadOutbox()).map((m) => m.id)).toEqual(["b"]);
  });

  it("stores and reads per-entity cursors as a map", async () => {
    await db.setCursor(BILL, 7);
    await db.setCursor(USER, 3);
    await db.setCursor(BILL, 12); // overwrite
    expect(await db.getCursors()).toEqual({ [BILL]: 12, [USER]: 3 });
  });

  it("round-trips arbitrary meta values", async () => {
    await db.setMeta("node_id", "device-xyz");
    expect(await db.getMeta<string>("node_id")).toBe("device-xyz");
    expect(await db.getMeta("missing")).toBeUndefined();
  });
});
