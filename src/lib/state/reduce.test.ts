import { describe, expect, it } from "vitest";
import type { Mutation, MutationType } from "$lib/sync/mutations";
import { type ChequeData, type UserData, allocationInput } from "./model";
import { type AnyMutation, applyChequeMutation, applyUserMutation } from "./reduce";

const CHEQUE = "00000000-0000-4000-8000-000000000000";
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hlc = (n: number) => `${String(n).padStart(15, "0")}:00000:dev`;

function mut<T extends MutationType>(
  type: T,
  hlcN: number,
  payload: Mutation<T>["payload"],
): AnyMutation {
  return {
    id: U(900 + hlcN),
    type,
    entity_id: CHEQUE,
    user_id: U(1),
    hlc: hlc(hlcN),
    payload,
  } as AnyMutation;
}

function emptyCheque(): ChequeData {
  return {
    id: CHEQUE,
    name: "",
    visibility: "private",
    is_stub: true,
    hlc: "",
    col_hlc: {},
    updated_at: "",
    cheque_people: [],
    cheque_items: [],
    cheque_item_splits: [],
    cheque_users: [],
  };
}

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  person_id: U(1),
  name: "Item",
  cost: 1000,
  sort: 0,
  ...over,
});
const split = (id: string, itemId: string, contribId: string, ratio: number) => ({
  id,
  item_id: itemId,
  person_id: contribId,
  ratio,
});

describe("applyChequeMutation — structural", () => {
  it("CREATE_CHEQUE populates the snapshot and materializes it", () => {
    const cheque = emptyCheque();
    applyChequeMutation(
      cheque,
      mut("CREATE_CHEQUE", 1, {
        cheque: {
          id: CHEQUE,
          name: "Dinner",
          visibility: "private",
          cheque_people: [{ id: U(1), name: "A", sort: 0 }],
          cheque_items: [
            {
              id: U(10),
              person_id: U(1),
              name: "Pizza",
              cost: 2000,
              sort: 0,
              cheque_item_splits: [split(U(20), U(10), U(1), 1)],
            },
          ],
        },
      }),
    );
    expect(cheque.is_stub).toBe(false);
    expect(cheque.name).toBe("Dinner");
    expect(cheque.cheque_people).toHaveLength(1);
    expect(cheque.cheque_items[0].name).toBe("Pizza");
    expect(cheque.cheque_item_splits[0].ratio).toBe(1);
    expect(cheque.cheque_items[0].is_stub).toBe(false);
  });

  it("ADD_ITEM then DELETE_ITEM removes the item and its splits", () => {
    const cheque = emptyCheque();
    applyChequeMutation(
      cheque,
      mut("ADD_ITEM", 1, { item: item(U(10)), splits: [split(U(20), U(10), U(1), 1)] }),
    );
    expect(cheque.cheque_items).toHaveLength(1);
    expect(cheque.cheque_item_splits).toHaveLength(1);
    applyChequeMutation(cheque, mut("DELETE_ITEM", 2, { id: U(10) }));
    expect(cheque.cheque_items).toHaveLength(0);
    expect(cheque.cheque_item_splits).toHaveLength(0);
  });

  it("DELETE_PERSON reassigns item payer and drops the person's splits", () => {
    const cheque = emptyCheque();
    applyChequeMutation(
      cheque,
      mut("ADD_PERSON", 1, { person: { id: U(1), name: "A", sort: 0 }, splits: [] }),
    );
    applyChequeMutation(
      cheque,
      mut("ADD_PERSON", 2, { person: { id: U(2), name: "B", sort: 1 }, splits: [] }),
    );
    applyChequeMutation(
      cheque,
      mut("ADD_ITEM", 3, {
        item: item(U(10), { person_id: U(2) }),
        splits: [split(U(20), U(10), U(2), 1), split(U(21), U(10), U(1), 1)],
      }),
    );
    applyChequeMutation(cheque, mut("DELETE_PERSON", 4, { personId: U(2), reassignToId: U(1) }));
    expect(cheque.cheque_people.map((c) => c.id)).toEqual([U(1)]);
    expect(cheque.cheque_items[0].person_id).toBe(U(1)); // reassigned
    expect(cheque.cheque_item_splits.map((s) => s.person_id)).toEqual([U(1)]); // U(2)'s split dropped
  });
});

describe("applyChequeMutation — HLC per-column LWW", () => {
  it("higher HLC wins on the same field; lower HLC is ignored", () => {
    const cheque = emptyCheque();
    applyChequeMutation(
      cheque,
      mut("ADD_ITEM", 5, { item: item(U(10), { name: "Orig" }), splits: [] }),
    );
    applyChequeMutation(cheque, mut("UPDATE_ITEM", 9, { id: U(10), name: "New" }));
    applyChequeMutation(cheque, mut("UPDATE_ITEM", 7, { id: U(10), name: "Stale" })); // lower HLC, ignored
    expect(cheque.cheque_items[0].name).toBe("New");
  });

  it("concurrent edits to DIFFERENT fields of the same row both survive", () => {
    const cheque = emptyCheque();
    applyChequeMutation(
      cheque,
      mut("ADD_ITEM", 5, { item: item(U(10), { name: "X", cost: 100 }), splits: [] }),
    );
    applyChequeMutation(cheque, mut("UPDATE_ITEM", 6, { id: U(10), name: "Renamed" }));
    applyChequeMutation(cheque, mut("UPDATE_ITEM", 7, { id: U(10), cost: 999 }));
    expect(cheque.cheque_items[0].name).toBe("Renamed");
    expect(cheque.cheque_items[0].cost).toBe(999);
  });

  it("re-applying the same mutation is a no-op (idempotent under LWW)", () => {
    const cheque = emptyCheque();
    const m = mut("UPDATE_ITEM", 8, { id: U(10), name: "Once" });
    applyChequeMutation(cheque, mut("ADD_ITEM", 5, { item: item(U(10)), splits: [] }));
    applyChequeMutation(cheque, m);
    const snapshot = JSON.stringify(cheque);
    applyChequeMutation(cheque, m);
    expect(JSON.stringify(cheque)).toBe(snapshot);
  });
});

describe("applyChequeMutation — out-of-order healing", () => {
  it("UPDATE_SPLIT arriving before its split creates a stub that heals on ADD_ITEM", () => {
    const cheque = emptyCheque();
    // split update arrives first — no item_id known yet
    applyChequeMutation(cheque, mut("UPDATE_SPLIT", 9, { id: U(20), ratio: 5 }));
    expect(cheque.cheque_item_splits).toHaveLength(1);
    expect(cheque.cheque_item_splits[0].is_stub).toBe(true);
    expect(cheque.cheque_item_splits[0].item_id).toBeNull();
    expect(cheque.cheque_item_splits[0].ratio).toBe(5);

    // the item (with the same split) arrives later → heals structural fields,
    // but the newer ratio (HLC 9) is preserved over the ADD's ratio (HLC 3).
    applyChequeMutation(
      cheque,
      mut("ADD_ITEM", 3, {
        item: item(U(10)),
        splits: [split(U(20), U(10), U(1), 1)],
      }),
    );
    const s = cheque.cheque_item_splits[0];
    expect(s.is_stub).toBe(false);
    expect(s.item_id).toBe(U(10)); // structural filled
    expect(s.person_id).toBe(U(1));
    expect(s.ratio).toBe(5); // newer HLC kept, not clobbered by the older ADD
  });
});

describe("applyChequeMutation — SNAPSHOT (compaction)", () => {
  it("replaces the snapshot wholesale (drops stale rows) and sets cheque_users", () => {
    const cheque = emptyCheque();
    // start with one item that should NOT survive the snapshot
    applyChequeMutation(cheque, mut("ADD_ITEM", 1, { item: item(U(99)), splits: [] }));
    expect(cheque.cheque_items.map((i) => i.id)).toEqual([U(99)]);

    applyChequeMutation(
      cheque,
      mut("SNAPSHOT", 9, {
        cheque: {
          id: CHEQUE,
          name: "Compacted",
          visibility: "private",
          cheque_people: [{ id: U(1), name: "A", sort: 0 }],
          cheque_items: [
            {
              id: U(10),
              person_id: U(1),
              name: "Fresh",
              cost: 500,
              sort: 0,
              cheque_item_splits: [split(U(20), U(10), U(1), 1)],
            },
          ],
          cheque_users: [
            { user_id: U(1), role: "owner", payment_id: "me@x", payment_method: "etransfer" },
          ],
        },
      }),
    );

    expect(cheque.name).toBe("Compacted");
    expect(cheque.cheque_items.map((i) => i.id)).toEqual([U(10)]); // U(99) dropped
    expect(cheque.cheque_item_splits).toHaveLength(1);
    expect(cheque.cheque_users[0]).toMatchObject({
      user_id: U(1),
      role: "owner",
      payment_id: "me@x",
    });
  });
});

describe("allocationInput", () => {
  it("regroups flat splits under their items, excluding stubs", () => {
    const cheque = emptyCheque();
    applyChequeMutation(
      cheque,
      mut("CREATE_CHEQUE", 1, {
        cheque: {
          id: CHEQUE,
          name: "B",
          visibility: "private",
          cheque_people: [
            { id: U(1), name: "A", sort: 0 },
            { id: U(2), name: "B", sort: 1 },
          ],
          cheque_items: [
            {
              id: U(10),
              person_id: U(1),
              name: "I",
              cost: 900,
              sort: 0,
              cheque_item_splits: [split(U(20), U(10), U(1), 1), split(U(21), U(10), U(2), 2)],
            },
          ],
        },
      }),
    );
    const input = allocationInput(cheque);
    expect(input.people).toHaveLength(2);
    expect(input.items).toHaveLength(1);
    expect(input.items[0].splits).toEqual([
      { person_id: U(1), ratio: 1 },
      { person_id: U(2), ratio: 2 },
    ]);
  });
});

describe("applyUserMutation", () => {
  it("applies UPDATE_USER fields under LWW", () => {
    const user: UserData = {
      id: U(1),
      default_visibility: "private",
      default_payment_id: null,
      default_payment_method: "etransfer",
      hlc: "",
      col_hlc: {},
      updated_at: "",
      cheques: [],
    };
    applyUserMutation(
      user,
      mut("UPDATE_USER", 5, { default_payment_id: "me@x.com" }) as AnyMutation,
    );
    expect(user.default_payment_id).toBe("me@x.com");
    applyUserMutation(
      user,
      mut("UPDATE_USER", 3, { default_payment_id: "stale@x.com" }) as AnyMutation,
    );
    expect(user.default_payment_id).toBe("me@x.com"); // lower HLC ignored
  });
});
