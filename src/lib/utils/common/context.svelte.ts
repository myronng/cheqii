import { page } from "$app/state";
import { type IBillState, BillState } from "$lib/utils/models/bill.svelte";
import { type ISyncState, SyncState } from "$lib/utils/models/sync.svelte";
import type { Mutation } from "$lib/utils/models/types";
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
    this.user = new UserState(() => this.#userId);
    this.bills = new BillState(() => this.user.data?.bills);
    this.sync = new SyncState(
      () => this.#userId,
      async (mutations) => {
        for (const m of mutations) {
          await this.applyIncomingMutation(m);
        }
      },
    );

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

  async applyIncomingMutation(mutation: Mutation) {
    const { type, payload, created_at, entity_id } = mutation;

    const checkLWW = (localUpdatedAt?: string) => {
      if (!localUpdatedAt) return true;
      return new Date(created_at) > new Date(localUpdatedAt);
    };

    switch (type) {
      case "CREATE_BILL":
      case "UPDATE_BILL": {
        const existing = this.bills.data?.find((b) => b.id === entity_id);
        if (!existing || checkLWW(existing.updated_at)) {
          const fullBill = existing ? { ...existing, ...payload } : payload.bill;
          if (fullBill) {
            fullBill.updated_at = created_at;
            await this.bills.update(fullBill);
          }
        }
        break;
      }
      case "DELETE_BILL":
        await this.bills.delete(entity_id);
        if (this.user.data?.bills.includes(entity_id)) {
          await this.user.update({
            bills: this.user.data.bills.filter((id) => id !== entity_id),
          });
        }
        break;

      case "LEAVE_BILL": {
        if (mutation.user_id === this.user.data?.id) {
          await this.bills.delete(entity_id);
          await this.user.update({
            bills: this.user.data.bills.filter((id) => id !== entity_id),
          });
        } else {
          const bill = this.bills.data?.find((b) => b.id === entity_id);
          if (bill) {
            bill.bill_users = bill.bill_users.filter((u) => u.user_id !== mutation.user_id);
            await this.bills.update(bill);
          }
        }
        break;
      }

      case "ADD_ITEM":
      case "UPDATE_ITEM": {
        const bill = this.bills.data?.find((b) => b.id === entity_id);
        if (!bill) return;

        if (type === "ADD_ITEM") {
          const exists = bill.bill_items.some((i) => i.id === payload.item.id);
          if (!exists) {
            bill.bill_items.push({
              ...payload.item,
              bill_item_splits: payload.splits,
            });
            await this.bills.update(bill);
          }
        } else {
          const item = bill.bill_items.find((i) => i.id === payload.id);
          if (item && checkLWW(item.updated_at)) {
            Object.assign(item, payload);
            item.updated_at = created_at;
            await this.bills.update(bill);
          }
        }
        break;
      }

      case "DELETE_ITEM": {
        const bill = this.bills.data?.find((b) => b.id === entity_id);
        if (!bill) return;
        const index = bill.bill_items.findIndex((i) => i.id === payload.id);
        if (index !== -1) {
          bill.bill_items.splice(index, 1);
          await this.bills.update(bill);
        }
        break;
      }

      case "ADD_CONTRIBUTOR":
      case "UPDATE_CONTRIBUTOR": {
        const bill = this.bills.data?.find((b) => b.id === entity_id);
        if (!bill) return;

        if (type === "ADD_CONTRIBUTOR") {
          const exists = bill.bill_contributors.some((c) => c.id === payload.contributor.id);
          if (!exists) {
            bill.bill_contributors.push(payload.contributor);
            payload.splits.forEach((s: any) => {
              const item = bill.bill_items.find((i) => i.id === s.item_id);
              if (item) item.bill_item_splits.push(s);
            });
            await this.bills.update(bill);
          }
        } else if (payload.is_bill_user) {
          const billUser = bill.bill_users.find((u) => u.user_id === payload.userId);
          if (billUser && checkLWW(billUser.updated_at)) {
            Object.assign(billUser, payload);
            billUser.updated_at = created_at;
            await this.bills.update(bill);
          }
        } else {
          const contributor = bill.bill_contributors.find((c) => c.id === payload.id);
          if (contributor && checkLWW(contributor.updated_at)) {
            Object.assign(contributor, payload);
            contributor.updated_at = created_at;
            await this.bills.update(bill);
          }
        }
        break;
      }

      case "DELETE_CONTRIBUTOR": {
        const bill = this.bills.data?.find((b) => b.id === entity_id);
        if (!bill) return;
        const index = bill.bill_contributors.findIndex((c) => c.id === payload.contributorId);
        if (index !== -1) {
          bill.bill_contributors.splice(index, 1);
          bill.bill_items.forEach((item) => {
            if (item.contributor_id === payload.contributorId)
              item.contributor_id = payload.reassignToId;
            item.bill_item_splits = item.bill_item_splits.filter(
              (s) => s.contributor_id !== payload.contributorId,
            );
          });
          await this.bills.update(bill);
        }
        break;
      }

      case "ADD_SPLIT": {
        const bill = this.bills.data?.find((b) => b.id === entity_id);
        if (!bill) return;
        const item = bill.bill_items.find((i) => i.id === payload.item_id);
        if (item) {
          const exists = item.bill_item_splits.some((s) => s.id === payload.id);
          if (!exists) {
            item.bill_item_splits.push(payload);
            await this.bills.update(bill);
          }
        }
        break;
      }

      case "UPDATE_SPLIT": {
        const bill = this.bills.data?.find((b) => b.id === entity_id);
        if (!bill) return;
        for (const item of bill.bill_items) {
          const split = item.bill_item_splits.find((s) => s.id === payload.id);
          if (split && checkLWW(split.updated_at)) {
            split.ratio = payload.ratio;
            split.updated_at = created_at;
            await this.bills.update(bill);
            break;
          }
        }
        break;
      }

      case "UPDATE_USER":
        if (this.user.data?.id === entity_id && checkLWW(this.user.data.updated_at)) {
          await this.user.update({ ...payload, updated_at: created_at });
        }
        break;
    }
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
