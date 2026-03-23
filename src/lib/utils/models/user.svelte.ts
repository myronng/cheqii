import { goto } from "$app/navigation";
import { getAppContext } from "$lib/utils/common/context.svelte";
import { idb } from "$lib/utils/common/indexedDb.svelte";
import { type BillData } from "$lib/utils/models/bill.svelte";
import type { Database } from "$lib/utils/models/database";
import { createMutation } from "$lib/utils/models/sync.svelte";

type UserDB = Database["public"]["Tables"]["users"]["Row"];

export type UserData = {
  bills: BillData["id"][];
  default_invite_required: UserDB["default_invite_required"];
  default_payment_id: UserDB["default_payment_id"];
  default_payment_method: UserDB["default_payment_method"];
  id: UserDB["id"];
  name?: string;
  updated_at: UserDB["updated_at"];
};

export type OnUserChange = (userData: Partial<UserData>) => Promise<void>;

export const PAYMENT_METHODS: NonNullable<UserDB["default_payment_method"]>[] = [
  "etransfer",
  "payPal",
];

export const initializeUser = (
  userData:
    | (Database["public"]["Tables"]["users"]["Row"] & {
        bill_users: Database["public"]["Tables"]["bill_users"]["Row"][];
      })
    | string,
): UserData => {
  if (typeof userData === "object") {
    return {
      bills: userData.bill_users.map((bill_user) => bill_user.bill_id),
      default_invite_required: userData.default_invite_required,
      default_payment_id: userData.default_payment_id,
      default_payment_method: userData.default_payment_method,
      id: userData.id,
      updated_at: new Date(userData.updated_at).toISOString(),
    };
  }

  return {
    bills: [],
    default_invite_required: false,
    default_payment_id: null,
    default_payment_method: PAYMENT_METHODS[0],
    id: userData,
    updated_at: new Date().toISOString(),
  };
};

export interface IUserState {
  readonly data: UserData | null;
  readonly initialized: boolean;
  delete(): Promise<void>;
  update(newUserData: Partial<UserData>): Promise<UserData | undefined>;
  apply(newUserData: UserData): void;
}

export class UserState implements IUserState {
  #data = $state<IUserState["data"]>(null);
  #initialized = $state(false);

  constructor(getUserId: () => string | undefined) {
    $effect(() => {
      const userId = getUserId();
      if (userId) {
        this.#initialized = false;
        this.#initialize(userId);
      } else {
        this.#data = null;
        this.#initialized = true;
      }
    });
  }

  get initialized() {
    return this.#initialized;
  }

  get data() {
    return this.#data;
  }

  async #initialize(userId: string) {
    const user = await idb?.get<UserData>("users", userId);
    if (!user) {
      this.#data = initializeUser(userId);
      await idb?.put("users", JSON.parse(JSON.stringify(this.#data)));
    } else {
      this.#data = user;
    }

    this.#initialized = true;
  }

  async update(newUserData: Parameters<IUserState["update"]>[0]) {
    if (!this.#data) return;

    this.#data = {
      ...this.#data,
      ...newUserData,
      updated_at: new Date().toISOString(),
    };
    await idb?.put("users", JSON.parse(JSON.stringify(this.#data)));
    return this.#data;
  }

  apply(newUserData: UserData) {
    this.#data = newUserData;
  }

  async delete() {
    if (!this.#data) return;
    const userId = this.#data.id;
    this.#data = null;
    await idb?.delete("users", userId);
  }
}

export const updateUser = async (payload: Partial<UserData>) => {
  const { user, sync } = getAppContext();
  if (!user.data) return;

  const mutation = createMutation("UPDATE_USER", payload, user.data.id, user.data.id);

  const updatedUser = {
    ...user.data,
    ...payload,
    updated_at: new Date().toISOString(),
  };

  await idb?.commitMutation("users", JSON.parse(JSON.stringify(updatedUser)), mutation);
  user.apply(updatedUser);
  sync.apply(mutation);
};

export const leaveBill = async (billData: BillData, userId: string) => {
  const { user, bills, sync } = getAppContext();

  const newBills = user.data?.bills.filter((id) => id !== billData.id) ?? [];

  const mutation = createMutation("LEAVE_BILL", {}, billData.id, userId);

  // Atomic dual-write: update user bills and add LEAVE_BILL mutation.
  // Note: We don't delete the bill from DB atomically here necessarily,
  // but LEAVE_BILL implies we lose access.
  // Ideally, we atomic commit the USER update.
  // The bill deletion is local cleanup.

  // Actually, LEAVE_BILL mutation entity_id is bill.id.
  // But we want to update the USER store.
  // This is tricky. commitMutation takes ONE store.
  // If we update USER store, we pass "users" and userData.
  // The mutation is LEAVE_BILL.
  // Logic:
  // 1. Update user data (remove bill ID).
  // 2. Commit to "users" store + Mutation.
  // 3. Apply user update.
  // 4. Delete bill from local memory/DB (cleanup).

  if (!user.data) return;

  const updatedUser: UserData = {
    ...user.data,
    bills: newBills,
    updated_at: new Date().toISOString(),
  };

  await idb?.commitMutation("users", JSON.parse(JSON.stringify(updatedUser)), mutation);

  user.apply(updatedUser);
  await bills.delete(billData.id);
  sync.apply(mutation);

  goto("/");
};
