import type { BillData, BillInvite } from "$lib/utils/common/bill.svelte.ts";

import { idb } from "$lib/utils/common/indexedDb.svelte";
import type { Database } from "../../../supabase";

export const PAYMENT_METHODS = ["etransfer"] as const;

export type AppUser = Metadata & {
  bills: BillData["id"][];
  email?: string;
  id: string;
  invite: Pick<BillInvite, "required">;
  name?: string;
  payment?: {
    id: string;
    method: (typeof PAYMENT_METHODS)[number];
  };
};

export type Metadata = {
  updatedAt: number;
};

export type OnUserChange = (userData: Partial<AppUser>) => Promise<void>;

export const initializeUser = (
  dbUser?:
    | (Database["public"]["Tables"]["users"]["Row"] & {
        bill_users: Database["public"]["Tables"]["bill_users"]["Row"][];
      })
    | string,
): AppUser => {
  if (typeof dbUser === "object") {
    return {
      bills: dbUser.bill_users.map((bill_user) => bill_user.bill_id),
      id: dbUser.id,
      invite: {
        required: dbUser.invite_default,
      },
      updatedAt: Date.parse(dbUser.updated_at),
    };
  } else {
    return {
      bills: [],
      id: dbUser ?? crypto.randomUUID(),
      invite: {
        required: false,
      },
      updatedAt: Date.now(),
    };
  }
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
        id: userId,
        invite: {
          required: false,
        },
        updatedAt: Date.now(),
      }),
      ...newUserData,
      updatedAt: Date.now(),
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
