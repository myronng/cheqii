import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

// Mock the auth helpers so the menu's actions are observable without a real client.
const { auth, APP } = vi.hoisted(() => ({
  auth: { signInWithGoogle: vi.fn(), signOut: vi.fn() },
  APP: { sync: null },
}));
vi.mock("$lib/utils/common/auth.svelte", () => auth);
vi.mock("$lib/state/app.svelte", () => ({ getAppContext: () => APP }));

import { LOCALE_MASTER } from "$lib/utils/common/locale";
import type { Session } from "@supabase/supabase-js";
import AccountButton from "./AccountButton.svelte";

const strings = LOCALE_MASTER["en-CA"];
const supabase = {} as never;

// Minimal session shape AccountButton reads (is_anonymous + user_metadata).
const sessionFor = (is_anonymous: boolean): Session =>
  ({ user: { is_anonymous, user_metadata: { full_name: "Myron Ng" } } }) as unknown as Session;

describe("AccountButton", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("permanent user → avatar opens a menu with a 'Log out' item that signs out", async () => {
    const { getByRole } = render(AccountButton, {
      props: { session: sessionFor(false), strings, supabase },
    });
    const logout = getByRole("menuitem", { name: strings["logOut"] });
    expect(logout).toBeTruthy();
    await fireEvent.click(logout);
    expect(auth.signOut).toHaveBeenCalledWith(APP, supabase, expect.any(Function));
    expect(auth.signInWithGoogle).not.toHaveBeenCalled();
  });

  it("guest (anonymous) → shows the sign-in button, no log-out menu", async () => {
    const { queryByRole, getByRole } = render(AccountButton, {
      props: { session: sessionFor(true), strings, supabase },
    });
    expect(queryByRole("menuitem")).toBeNull();
    await fireEvent.click(getByRole("button", { name: strings["signInWithGoogle"] }));
    expect(auth.signInWithGoogle).toHaveBeenCalledWith(supabase);
  });
});
