import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

// Mirror EntryGrid's harness: actions → spies, app/navigation/state → stubs.
const { actions, APP, goto } = vi.hoisted(() => ({
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
  goto: vi.fn(),
}));
vi.mock("$lib/state/actions", () => actions);
vi.mock("$lib/state/app.svelte", () => ({ getAppContext: () => APP }));
vi.mock("$app/navigation", () => ({ goto }));
vi.mock("$app/state", () => ({ page: { url: new URL("http://localhost/cheques/x") } }));

import { allocate } from "$lib/domain/allocate";
import { settle } from "$lib/domain/settle";
import { allocationInput, type ChequeData } from "$lib/state/model";
import { LOCALE_MASTER } from "$lib/utils/common/locale";
import EntryCards from "./EntryCards.svelte";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CHEQUE = U(500);
const strings = LOCALE_MASTER["en-CA"];

// Alice (U1) paid Pizza 2000, split evenly with Bob (U2) → Bob owes Alice 1000.
// A second item makes canDelete true.
function chequeData(): ChequeData {
  const row = { hlc: "", col_hlc: {}, is_stub: false, updated_at: "" };
  return {
    id: CHEQUE,
    name: "Dinner",
    visibility: "private",
    ...row,
    cheque_people: [
      { cheque_id: CHEQUE, id: U(1), name: "Alice", sort: 0, linked_user_id: null, ...row },
      { cheque_id: CHEQUE, id: U(2), name: "Bob", sort: 1, linked_user_id: null, ...row },
    ],
    cheque_items: [
      { cheque_id: CHEQUE, id: U(10), person_id: U(1), name: "Pizza", cost: 2000, sort: 0, ...row },
      { cheque_id: CHEQUE, id: U(11), person_id: U(2), name: "Soda", cost: 0, sort: 1, ...row },
    ],
    cheque_item_splits: [
      { cheque_id: CHEQUE, id: U(20), item_id: U(10), person_id: U(1), ratio: 1, ...row },
      { cheque_id: CHEQUE, id: U(21), item_id: U(10), person_id: U(2), ratio: 1, ...row },
      { cheque_id: CHEQUE, id: U(22), item_id: U(11), person_id: U(1), ratio: 0, ...row },
      { cheque_id: CHEQUE, id: U(23), item_id: U(11), person_id: U(2), ratio: 0, ...row },
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

function renderCards() {
  const cheque = chequeData();
  const input = allocationInput(cheque);
  const allocations = allocate(input.people, input.items);
  return render(EntryCards, {
    props: {
      allocations,
      chequeData: cheque,
      currencyFactor: 100,
      currencyFormatter: new Intl.NumberFormat("en-CA", {
        minimumFractionDigits: 2,
        style: "decimal",
      }),
      settlement: settle(allocations),
      strings,
      userId: U(1),
    },
  });
}

describe("EntryCards (mobile editor)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("renders a balance chip per real person", () => {
    const { container } = renderCards();
    const names = [...container.querySelectorAll(".people .person-name")].map((e) => e.textContent);
    expect(names).toEqual(["Alice", "Bob"]);
  });

  it("renders an item card per real item", () => {
    const { container } = renderCards();
    expect(container.querySelectorAll(".items .card").length).toBe(2);
  });

  it("'Add item' calls addItem with a split per person", async () => {
    const { getByRole } = renderCards();
    await fireEvent.click(getByRole("button", { name: strings["addItem"] }));
    const [, chequeId, payload] = actions.addItem.mock.calls[0];
    expect(chequeId).toBe(CHEQUE);
    expect(payload.item.person_id).toBe(U(1));
    expect(payload.splits).toHaveLength(2);
  });

  it("'Add person' calls addPerson with a split per item", async () => {
    const { getByRole } = renderCards();
    await fireEvent.click(getByRole("button", { name: strings["addPerson"] }));
    const [, chequeId, payload] = actions.addPerson.mock.calls[0];
    expect(chequeId).toBe(CHEQUE);
    expect(payload.splits).toHaveLength(2);
  });

  it("tapping an included share chip toggles its ratio to 0", async () => {
    const { container } = renderCards();
    // First card (Pizza), first chip = Alice (ratio 1) → toggles off.
    const chip = container.querySelector(".items .card .shares .chip") as HTMLElement;
    await fireEvent.click(chip);
    expect(actions.updateSplitRatio).toHaveBeenCalledWith(APP, CHEQUE, { id: U(20), ratio: 0 });
  });

  it("'Customize' reveals ratio steppers that write the weight", async () => {
    const { container } = renderCards();
    const firstCard = container.querySelector(".items .card") as HTMLElement;
    const customize = [...firstCard.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === strings["customize"],
    ) as HTMLElement;
    await fireEvent.click(customize);
    const weightInput = firstCard.querySelector(".weights input") as HTMLInputElement;
    await fireEvent.change(weightInput, { target: { value: "3" } });
    expect(actions.updateSplitRatio).toHaveBeenCalledWith(APP, CHEQUE, { id: U(20), ratio: 3 });
  });

  it("a per-item delete (canDelete) calls deleteItem", async () => {
    const { container } = renderCards();
    const del = container.querySelector('.items .card button[title="Remove Pizza"]') as HTMLElement;
    expect(del).not.toBeNull();
    await fireEvent.click(del);
    expect(actions.deleteItem).toHaveBeenCalledWith(APP, CHEQUE, U(10));
  });

  it("the settle CTA opens the #settle sheet", async () => {
    const { getByRole } = renderCards();
    await fireEvent.click(getByRole("button", { name: /Settle up/ }));
    expect(goto).toHaveBeenCalledWith(expect.stringContaining("#settle"), expect.anything());
  });
});
