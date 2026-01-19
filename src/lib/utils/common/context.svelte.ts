import { page } from "$app/state";
import { type IBillState, BillState } from "$lib/utils/models/bill.svelte";
import { type ISyncState, SyncState } from "$lib/utils/models/sync.svelte";
import { type IUserState, UserState } from "$lib/utils/models/user.svelte";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { getContext, setContext } from "svelte";

const APP_KEY = Symbol("app");

export interface IAppState {
  user: IUserState;
  bills: IBillState;
  sync: ISyncState;
  readonly initialized: boolean;
}

export class AppState implements IAppState {
  user: UserState = null!;
  bills: BillState = null!;
  sync: SyncState = null!;
  #userId = $state<string | undefined>(undefined);

  initialized = $derived(this.user?.initialized && this.bills?.initialized);

  constructor() {
    // Initialize stable instances once (sync) to ensure effects are rooted
    this.user = new UserState(() => this.#userId);
    this.bills = new BillState(() => this.user.data?.bills);
    this.sync = new SyncState(() => this.#userId);

    $effect(() => {
      const supabase = page.data.supabase;
      if (!supabase) return;

      let active = true;

      const checkUser = async () => {
        const {
          data: { user: supabaseUser },
        } = await supabase.auth.getUser();
        if (!active) return;

        const newUserId = supabaseUser?.id;
        if (newUserId !== this.#userId) {
          this.#userId = newUserId;
        }
      };

      checkUser();

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
          checkUser();
        }
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    });
  }
}

export function setAppContext() {
  const appState = new AppState();
  setContext(APP_KEY, appState);
  return appState;
}

export function getAppContext() {
  return getContext<IAppState>(APP_KEY);
}
