import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

// Mock the v2 state layer: actions become spies, getAppContext returns a stub.
// (vi.hoisted so the spies exist before the hoisted vi.mock factories run.)
const { actions, APP } = vi.hoisted(() => ({
  actions: {
    addItem: vi.fn(),
    addPerson: vi.fn(),
    deletePerson: vi.fn(),
    deleteItem: vi.fn(),
    updatePerson: vi.fn(),
    updateItem: vi.fn(),
    updateSplitRatio: vi.fn(),
  },
  APP: { user: { data: { id: "00000000-0000-4000-8000-000000000001" } } },
}));
vi.mock("$lib/state/actions", () => actions);
vi.mock("$lib/state/app.svelte", () => ({ getAppContext: () => APP }));
vi.mock("$app/navigation", () => ({ goto: vi.fn() }));
vi.mock("$app/state", () => ({ page: { url: new URL("http://localhost/cheques/x") } }));

import { allocate } from "$lib/domain/allocate";
import { allocationInput, type ChequeData } from "$lib/state/model";
import { LOCALE_MASTER } from "$lib/utils/common/locale";
import EntryGrid from "./EntryGrid.svelte";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CHEQUE = U(500);
const strings = LOCALE_MASTER["en-CA"];

function chequeData(): ChequeData {
  const row = { hlc: "", col_hlc: {}, is_stub: false, updated_at: "" };
  return {
    id: CHEQUE,
    name: "Dinner",
    visibility: "private",
    ...row,
    cheque_people: [
      { cheque_id: CHEQUE, id: U(1), name: "Alice", sort: 0, linked_user_id: null, ...row },
    ],
    cheque_items: [
      {
        cheque_id: CHEQUE,
        id: U(10),
        person_id: U(1),
        name: "Pizza",
        cost: 2000,
        sort: 0,
        ...row,
      },
    ],
    cheque_item_splits: [
      { cheque_id: CHEQUE, id: U(20), item_id: U(10), person_id: U(1), ratio: 1, ...row },
    ],
    cheque_users: [
      {
        cheque_id: CHEQUE,
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
  const cheque = chequeData();
  const input = allocationInput(cheque);
  return render(EntryGrid, {
    props: {
      allocations: allocate(input.people, input.items),
      chequeData: cheque,
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

  it("changing an item name calls updateItem(app, chequeId, {id, name})", async () => {
    const { getByTitle } = renderGrid();
    const nameInput = getByTitle("Item 1"); // item name cell (strings["item{index}"])
    await fireEvent.change(nameInput, { target: { value: "Soda" } });
    expect(actions.updateItem).toHaveBeenCalledWith(APP, CHEQUE, { id: U(10), name: "Soda" });
  });

  it("'Add Item' calls addItem with a new item + a split per person", async () => {
    const { getByRole } = renderGrid();
    await fireEvent.click(getByRole("button", { name: strings["addItem"] }));
    expect(actions.addItem).toHaveBeenCalledTimes(1);
    const [, chequeId, payload] = actions.addItem.mock.calls[0];
    expect(chequeId).toBe(CHEQUE);
    expect(payload.item.person_id).toBe(U(1));
    expect(payload.splits).toHaveLength(1); // one per person
  });

  it("'Add Person' calls addPerson with a split per item", async () => {
    const { getByRole } = renderGrid();
    await fireEvent.click(getByRole("button", { name: strings["addPerson"] }));
    expect(actions.addPerson).toHaveBeenCalledTimes(1);
    const [, chequeId, payload] = actions.addPerson.mock.calls[0];
    expect(chequeId).toBe(CHEQUE);
    expect(payload.splits).toHaveLength(1); // one per item
  });
});
