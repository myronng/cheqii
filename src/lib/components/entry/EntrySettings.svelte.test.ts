import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { actions, APP } = vi.hoisted(() => ({
  actions: { deleteCheque: vi.fn(), leaveCheque: vi.fn(), updateCheque: vi.fn() },
  APP: { user: { data: { id: "00000000-0000-4000-8000-000000000001" } } },
}));
vi.mock("$lib/state/actions", () => actions);
vi.mock("$lib/state/app.svelte", () => ({ getAppContext: () => APP }));
// Dialog is hash-driven; with no matching hash it stays closed (content is still
// in the DOM for queries) and never calls the native showModal happy-dom lacks.
vi.mock("$app/navigation", () => ({ goto: vi.fn() }));
// No supabase client in the unit env → the invite-link effect no-ops (guarded).
vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/cheques/x"), data: { supabase: undefined } },
}));

import type { ChequeData } from "$lib/state/model";
import { LOCALE_MASTER } from "$lib/utils/common/locale";
import EntrySettings from "./EntrySettings.svelte";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CHEQUE = U(500);
const strings = LOCALE_MASTER["en-CA"];

function ownerCheque(): ChequeData {
  const row = { hlc: "", col_hlc: {}, is_stub: false, updated_at: "" };
  return {
    id: CHEQUE,
    name: "Dinner",
    visibility: "private",
    ...row,
    cheque_people: [
      { cheque_id: CHEQUE, id: U(1), name: "Alice", sort: 0, linked_user_id: null, ...row },
    ],
    cheque_items: [],
    cheque_item_splits: [],
    cheque_users: [
      {
        cheque_id: CHEQUE,
        user_id: U(1),
        role: "owner",
        payment_id: null,
        payment_method: null,
        claim_dismissed: false,
        ...row,
      },
    ],
  };
}

function renderSettings() {
  return render(EntrySettings, {
    props: {
      chequeData: ownerCheque(),
      currencyFactor: 100,
      strings,
      url: "http://localhost/cheques/x",
      userId: U(1),
    },
  });
}

describe("EntrySettings (v2 actions)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("an owner sees Delete cheque and clicking it calls deleteCheque", async () => {
    const { getByText } = renderSettings();
    await fireEvent.click(getByText(strings["deleteCheque"])); // owner-only; click bubbles to the button
    expect(actions.deleteCheque).toHaveBeenCalledWith(APP, CHEQUE);
    expect(actions.leaveCheque).not.toHaveBeenCalled();
  });
});
