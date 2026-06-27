import { describe, expect, it } from "vitest";
import type { Mutation, MutationType } from "$lib/sync/mutations";
import { type BillData, type UserData, allocationInput } from "./model";
import { type AnyMutation, applyBillMutation, applyUserMutation } from "./reduce";

const BILL = "00000000-0000-4000-8000-000000000000";
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
    entity_id: BILL,
    user_id: U(1),
    hlc: hlc(hlcN),
    payload,
  } as AnyMutation;
}

function emptyBill(): BillData {
  return {
    id: BILL,
    name: "",
    visibility: "private",
    is_stub: true,
    hlc: "",
    col_hlc: {},
    updated_at: "",
    bill_contributors: [],
    bill_items: [],
    bill_item_splits: [],
    bill_users: [],
  };
}

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  contributor_id: U(1),
  name: "Item",
  cost: 1000,
  sort: 0,
  ...over,
});
const split = (id: string, itemId: string, contribId: string, ratio: number) => ({
  id,
  item_id: itemId,
  contributor_id: contribId,
  ratio,
});

describe("applyBillMutation — structural", () => {
  it("CREATE_BILL populates the snapshot and materializes it", () => {
    const bill = emptyBill();
    applyBillMutation(
      bill,
      mut("CREATE_BILL", 1, {
        bill: {
          id: BILL,
          name: "Dinner",
          visibility: "private",
          bill_contributors: [{ id: U(1), name: "A", sort: 0 }],
          bill_items: [
            {
              id: U(10),
              contributor_id: U(1),
              name: "Pizza",
              cost: 2000,
              sort: 0,
              bill_item_splits: [split(U(20), U(10), U(1), 1)],
            },
          ],
        },
      }),
    );
    expect(bill.is_stub).toBe(false);
    expect(bill.name).toBe("Dinner");
    expect(bill.bill_contributors).toHaveLength(1);
    expect(bill.bill_items[0].name).toBe("Pizza");
    expect(bill.bill_item_splits[0].ratio).toBe(1);
    expect(bill.bill_items[0].is_stub).toBe(false);
  });

  it("ADD_ITEM then DELETE_ITEM removes the item and its splits", () => {
    const bill = emptyBill();
    applyBillMutation(
      bill,
      mut("ADD_ITEM", 1, { item: item(U(10)), splits: [split(U(20), U(10), U(1), 1)] }),
    );
    expect(bill.bill_items).toHaveLength(1);
    expect(bill.bill_item_splits).toHaveLength(1);
    applyBillMutation(bill, mut("DELETE_ITEM", 2, { id: U(10) }));
    expect(bill.bill_items).toHaveLength(0);
    expect(bill.bill_item_splits).toHaveLength(0);
  });

  it("DELETE_CONTRIBUTOR reassigns item payer and drops the contributor's splits", () => {
    const bill = emptyBill();
    applyBillMutation(
      bill,
      mut("ADD_CONTRIBUTOR", 1, { contributor: { id: U(1), name: "A", sort: 0 }, splits: [] }),
    );
    applyBillMutation(
      bill,
      mut("ADD_CONTRIBUTOR", 2, { contributor: { id: U(2), name: "B", sort: 1 }, splits: [] }),
    );
    applyBillMutation(
      bill,
      mut("ADD_ITEM", 3, {
        item: item(U(10), { contributor_id: U(2) }),
        splits: [split(U(20), U(10), U(2), 1), split(U(21), U(10), U(1), 1)],
      }),
    );
    applyBillMutation(
      bill,
      mut("DELETE_CONTRIBUTOR", 4, { contributorId: U(2), reassignToId: U(1) }),
    );
    expect(bill.bill_contributors.map((c) => c.id)).toEqual([U(1)]);
    expect(bill.bill_items[0].contributor_id).toBe(U(1)); // reassigned
    expect(bill.bill_item_splits.map((s) => s.contributor_id)).toEqual([U(1)]); // U(2)'s split dropped
  });
});

describe("applyBillMutation — HLC per-column LWW", () => {
  it("higher HLC wins on the same field; lower HLC is ignored", () => {
    const bill = emptyBill();
    applyBillMutation(
      bill,
      mut("ADD_ITEM", 5, { item: item(U(10), { name: "Orig" }), splits: [] }),
    );
    applyBillMutation(bill, mut("UPDATE_ITEM", 9, { id: U(10), name: "New" }));
    applyBillMutation(bill, mut("UPDATE_ITEM", 7, { id: U(10), name: "Stale" })); // lower HLC, ignored
    expect(bill.bill_items[0].name).toBe("New");
  });

  it("concurrent edits to DIFFERENT fields of the same row both survive", () => {
    const bill = emptyBill();
    applyBillMutation(
      bill,
      mut("ADD_ITEM", 5, { item: item(U(10), { name: "X", cost: 100 }), splits: [] }),
    );
    applyBillMutation(bill, mut("UPDATE_ITEM", 6, { id: U(10), name: "Renamed" }));
    applyBillMutation(bill, mut("UPDATE_ITEM", 7, { id: U(10), cost: 999 }));
    expect(bill.bill_items[0].name).toBe("Renamed");
    expect(bill.bill_items[0].cost).toBe(999);
  });

  it("re-applying the same mutation is a no-op (idempotent under LWW)", () => {
    const bill = emptyBill();
    const m = mut("UPDATE_ITEM", 8, { id: U(10), name: "Once" });
    applyBillMutation(bill, mut("ADD_ITEM", 5, { item: item(U(10)), splits: [] }));
    applyBillMutation(bill, m);
    const snapshot = JSON.stringify(bill);
    applyBillMutation(bill, m);
    expect(JSON.stringify(bill)).toBe(snapshot);
  });
});

describe("applyBillMutation — out-of-order healing", () => {
  it("UPDATE_SPLIT arriving before its split creates a stub that heals on ADD_ITEM", () => {
    const bill = emptyBill();
    // split update arrives first — no item_id known yet
    applyBillMutation(bill, mut("UPDATE_SPLIT", 9, { id: U(20), ratio: 5 }));
    expect(bill.bill_item_splits).toHaveLength(1);
    expect(bill.bill_item_splits[0].is_stub).toBe(true);
    expect(bill.bill_item_splits[0].item_id).toBeNull();
    expect(bill.bill_item_splits[0].ratio).toBe(5);

    // the item (with the same split) arrives later → heals structural fields,
    // but the newer ratio (HLC 9) is preserved over the ADD's ratio (HLC 3).
    applyBillMutation(
      bill,
      mut("ADD_ITEM", 3, {
        item: item(U(10)),
        splits: [split(U(20), U(10), U(1), 1)],
      }),
    );
    const s = bill.bill_item_splits[0];
    expect(s.is_stub).toBe(false);
    expect(s.item_id).toBe(U(10)); // structural filled
    expect(s.contributor_id).toBe(U(1));
    expect(s.ratio).toBe(5); // newer HLC kept, not clobbered by the older ADD
  });
});

describe("applyBillMutation — SNAPSHOT (compaction)", () => {
  it("replaces the snapshot wholesale (drops stale rows) and sets bill_users", () => {
    const bill = emptyBill();
    // start with one item that should NOT survive the snapshot
    applyBillMutation(bill, mut("ADD_ITEM", 1, { item: item(U(99)), splits: [] }));
    expect(bill.bill_items.map((i) => i.id)).toEqual([U(99)]);

    applyBillMutation(
      bill,
      mut("SNAPSHOT", 9, {
        bill: {
          id: BILL,
          name: "Compacted",
          visibility: "private",
          bill_contributors: [{ id: U(1), name: "A", sort: 0 }],
          bill_items: [
            {
              id: U(10),
              contributor_id: U(1),
              name: "Fresh",
              cost: 500,
              sort: 0,
              bill_item_splits: [split(U(20), U(10), U(1), 1)],
            },
          ],
          bill_users: [
            { user_id: U(1), role: "owner", payment_id: "me@x", payment_method: "etransfer" },
          ],
        },
      }),
    );

    expect(bill.name).toBe("Compacted");
    expect(bill.bill_items.map((i) => i.id)).toEqual([U(10)]); // U(99) dropped
    expect(bill.bill_item_splits).toHaveLength(1);
    expect(bill.bill_users[0]).toMatchObject({ user_id: U(1), role: "owner", payment_id: "me@x" });
  });
});

describe("allocationInput", () => {
  it("regroups flat splits under their items, excluding stubs", () => {
    const bill = emptyBill();
    applyBillMutation(
      bill,
      mut("CREATE_BILL", 1, {
        bill: {
          id: BILL,
          name: "B",
          visibility: "private",
          bill_contributors: [
            { id: U(1), name: "A", sort: 0 },
            { id: U(2), name: "B", sort: 1 },
          ],
          bill_items: [
            {
              id: U(10),
              contributor_id: U(1),
              name: "I",
              cost: 900,
              sort: 0,
              bill_item_splits: [split(U(20), U(10), U(1), 1), split(U(21), U(10), U(2), 2)],
            },
          ],
        },
      }),
    );
    const input = allocationInput(bill);
    expect(input.contributors).toHaveLength(2);
    expect(input.items).toHaveLength(1);
    expect(input.items[0].splits).toEqual([
      { contributor_id: U(1), ratio: 1 },
      { contributor_id: U(2), ratio: 2 },
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
      bills: [],
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
