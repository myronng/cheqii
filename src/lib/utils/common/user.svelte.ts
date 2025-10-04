import type {
  ChequeData,
  ChequeInvite,
} from "$lib/utils/common/cheque.svelte.ts";

import { idb } from "$lib/utils/common/indexedDb.svelte";

export const PAYMENT_METHODS = ["etransfer"] as const;

export type CheqiiUser = Metadata & {
  cheques: ChequeData["id"][];
  email?: string;
  id: string;
  invite: Pick<ChequeInvite, "required">;
  name?: string;
  payment?: {
    id: string;
    method: (typeof PAYMENT_METHODS)[number];
  };
};

export type Metadata = {
  serverSignature?: string;
  updatedAtClient: number;
  updatedAtServer?: number;
};

export type OnUserChange = (userData: Partial<CheqiiUser>) => Promise<void>;

let userData = $state<CheqiiUser | null>(null);

export const getUser = async (userId: CheqiiUser["id"]) => {
  const user = await idb?.get<CheqiiUser>("users", userId);
  if (!user) {
    userData = {
      cheques: [],
      id: userId,
      invite: {
        required: false,
      },
      updatedAtClient: Date.now(),
    };
    await idb?.put("users", JSON.parse(JSON.stringify(userData)));
  } else {
    userData = user;
  }

  async function set(newUserData: Partial<CheqiiUser>) {
    userData = {
      ...(userData ?? {
        cheques: [],
        id: userId,
        invite: {
          required: false,
        },
        updatedAtClient: Date.now(),
      }),
      ...newUserData,
      updatedAtClient: Date.now(),
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
