import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

// Mock the v2 state layer: actions become spies, getAppContext returns a stub.
// (vi.hoisted so the spies exist before the hoisted vi.mock factories run.)
const { actions, APP } = vi.hoisted(() => ({
  actions: {
    addItem: vi.fn(),
    addContributor: vi.fn(),
    deleteContributor: vi.fn(),
    deleteItem: vi.fn(),
    updateContributor: vi.fn(),
    updateItem: vi.fn(),
    updateSplitRatio: vi.fn(),
  },
  APP: { user: { data: { id: "00000000-0000-4000-8000-000000000001" } } },
}));
vi.mock("$lib/state/actions", () => actions);
vi.mock("$lib/state/app.svelte", () => ({ getAppContext: () => APP }));

import { allocate } from "$lib/domain/allocate";
import { allocationInput, type BillData } from "$lib/state/model";
import { LOCALE_MASTER } from "$lib/utils/common/locale";
import EntryGrid from "./EntryGrid.svelte";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BILL = U(500);
const strings = LOCALE_MASTER["en-CA"];

function billData(): BillData {
  const row = { hlc: "", col_hlc: {}, is_stub: false, updated_at: "" };
  return {
    id: BILL,
    name: "Dinner",
    visibility: "private",
    ...row,
    bill_contributors: [
      { bill_id: BILL, id: U(1), name: "Alice", sort: 0, linked_user_id: null, ...row },
    ],
    bill_items: [
      {
        bill_id: BILL,
        id: U(10),
        contributor_id: U(1),
        name: "Pizza",
        cost: 2000,
        sort: 0,
        ...row,
      },
    ],
    bill_item_splits: [
      { bill_id: BILL, id: U(20), item_id: U(10), contributor_id: U(1), ratio: 1, ...row },
    ],
    bill_users: [
      {
        bill_id: BILL,
        user_id: U(1),
        role: "owner",
        payment_id: null,
        payment_method: null,
        ...row,
      },
    ],
  };
}

function renderGrid() {
  const bill = billData();
  const input = allocationInput(bill);
  return render(EntryGrid, {
    props: {
      allocations: allocate(input.contributors, input.items),
      billData: bill,
      contributorSummaryIndex: -1,
      currencyFactor: 100,
      currencyFormatter: new Intl.NumberFormat("en-CA", {
        minimumFractionDigits: 2,
        style: "decimal",
      }),
      strings,
      userId: U(1),
    },
  });
}

describe("EntryGrid (v2 actions)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("changing an item name calls updateItem(app, billId, {id, name})", async () => {
    const { getByTitle } = renderGrid();
    const nameInput = getByTitle("Item 1"); // item name cell (strings["item{index}"])
    await fireEvent.change(nameInput, { target: { value: "Soda" } });
    expect(actions.updateItem).toHaveBeenCalledWith(APP, BILL, { id: U(10), name: "Soda" });
  });

  it("'Add Item' calls addItem with a new item + a split per contributor", async () => {
    const { getByRole } = renderGrid();
    await fireEvent.click(getByRole("button", { name: strings["addItem"] }));
    expect(actions.addItem).toHaveBeenCalledTimes(1);
    const [, billId, payload] = actions.addItem.mock.calls[0];
    expect(billId).toBe(BILL);
    expect(payload.item.contributor_id).toBe(U(1));
    expect(payload.splits).toHaveLength(1); // one per contributor
  });

  it("'Add Contributor' calls addContributor with a split per item", async () => {
    const { getByRole } = renderGrid();
    await fireEvent.click(getByRole("button", { name: strings["addContributor"] }));
    expect(actions.addContributor).toHaveBeenCalledTimes(1);
    const [, billId, payload] = actions.addContributor.mock.calls[0];
    expect(billId).toBe(BILL);
    expect(payload.splits).toHaveLength(1); // one per item
  });
});
