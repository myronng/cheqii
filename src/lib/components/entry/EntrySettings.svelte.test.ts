import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { actions, APP } = vi.hoisted(() => ({
  actions: { deleteBill: vi.fn(), leaveBill: vi.fn(), updateBill: vi.fn() },
  APP: { user: { data: { id: "00000000-0000-4000-8000-000000000001" } } },
}));
vi.mock("$lib/state/actions", () => actions);
vi.mock("$lib/state/app.svelte", () => ({ getAppContext: () => APP }));
// Dialog is hash-driven; with no matching hash it stays closed (content is still
// in the DOM for queries) and never calls the native showModal happy-dom lacks.
vi.mock("$app/navigation", () => ({ goto: vi.fn() }));
// No supabase client in the unit env → the invite-link effect no-ops (guarded).
vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/bills/x"), data: { supabase: undefined } },
}));

import type { BillData } from "$lib/state/model";
import { LOCALE_MASTER } from "$lib/utils/common/locale";
import EntrySettings from "./EntrySettings.svelte";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BILL = U(500);
const strings = LOCALE_MASTER["en-CA"];

function ownerBill(): BillData {
  const row = { hlc: "", col_hlc: {}, is_stub: false, updated_at: "" };
  return {
    id: BILL,
    name: "Dinner",
    visibility: "private",
    ...row,
    bill_contributors: [
      { bill_id: BILL, id: U(1), name: "Alice", sort: 0, linked_user_id: null, ...row },
    ],
    bill_items: [],
    bill_item_splits: [],
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

function renderSettings() {
  return render(EntrySettings, {
    props: {
      billData: ownerBill(),
      currencyFactor: 100,
      strings,
      url: "http://localhost/bills/x",
      userId: U(1),
    },
  });
}

describe("EntrySettings (v2 actions)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("an owner sees Delete bill and clicking it calls deleteBill", async () => {
    const { getByText } = renderSettings();
    await fireEvent.click(getByText(strings["deleteBill"])); // owner-only; click bubbles to the button
    expect(actions.deleteBill).toHaveBeenCalledWith(APP, BILL);
    expect(actions.leaveBill).not.toHaveBeenCalled();
  });
});
