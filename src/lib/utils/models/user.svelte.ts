import type { BillData } from "$lib/utils/models/bill.svelte.ts";

import { idb } from "$lib/utils/common/indexedDb.svelte";
import type { Database } from "$lib/utils/models/database";

type UserDB = Database["public"]["Tables"]["users"]["Row"];

export type AppUser = {
  bills: BillData["id"][];
  default_invite_required: UserDB["default_invite_required"];
  default_payment_id: UserDB["default_payment_id"];
  default_payment_method: UserDB["default_payment_method"];
  email?: UserDB;
  id: UserDB["id"];
  name?: string;
  updated_at: UserDB["updated_at"];
};

export type OnUserChange = (userData: Partial<AppUser>) => Promise<void>;

export const PAYMENT_METHODS: NonNullable<UserDB["default_payment_method"]>[] =
  ["etransfer", "payPal"];

export const initializeUser = (
  userData?:
    | (Database["public"]["Tables"]["users"]["Row"] & {
        bill_users: Database["public"]["Tables"]["bill_users"]["Row"][];
      })
    | string
): AppUser => {
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
    id: userData ?? crypto.randomUUID(),
    updated_at: new Date().toISOString(),
  };
};

let userData = $state<AppUser | null>(null);

export const getUser = async (userId: AppUser["id"]) => {
  const user = await idb?.get<AppUser>("users", userId);
  if (!user) {
    userData = initializeUser(userId);
    await idb?.put("users", JSON.parse(JSON.stringify(userData)));
  } else {
    userData = user;
  }

  async function set(newUserData: Partial<AppUser>) {
    userData = {
      ...(userData ?? {
        bills: [],
        default_invite_required: false,
        default_payment_id: null,
        default_payment_method: PAYMENT_METHODS[0],
        id: userId,
      }),
      ...newUserData,
      updated_at: new Date().toISOString(),
    };
    await idb?.put("users", JSON.parse(JSON.stringify(userData)));
    return userData;
  }

  return {
    get get() {
      return userData;
    },
    set,
  };
};
