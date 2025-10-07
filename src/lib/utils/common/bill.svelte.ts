import { goto } from "$app/navigation";
import { DATE_FORMATTER } from "$lib/utils/common/formatter";
import { idb } from "$lib/utils/common/indexedDb.svelte";
import {
  type LocalizedStrings,
  interpolateString,
} from "$lib/utils/common/locale";
import {
  type AppUser,
  type Metadata,
  getUser,
} from "$lib/utils/common/user.svelte";

export type AccessType = "invited" | "owner" | "public";

export type BillData = Metadata & {
  access: {
    invite: BillInvite;
    users: Record<AppUser["id"], BillUserAccess>;
  };
  contributors: Contributor[];
  id: string;
  items: Item[];
  name: string;
};
export type BillInvite = {
  id: string;
  required: boolean;
};
export type BillUserAccess = Pick<AppUser, "email" | "name" | "payment"> & {
  authority: AccessType;
};

export type Contributor = {
  id: AppUser["id"];
  name: string;
};

export type Item = {
  buyer: number;
  cost: number;
  name: string;
  split: number[];
};

export type OnBillChange = (billData: BillData) => Promise<void>;

export const INVITE_ACCESS = new Set(["invited", "owner"]);

export const initializeBill = (
  strings: LocalizedStrings,
  user: AppUser,
): BillData => {
  const userAccess: BillUserAccess = {
    authority: "owner",
  };
  if (user.email) {
    userAccess.email = user.email;
  }
  if (user.name) {
    userAccess.name = user.name;
  }
  if (user.payment) {
    userAccess.payment = user.payment;
  }
  return {
    access: {
      invite: {
        id: crypto.randomUUID(),
        required: true,
      },
      users: {
        [user.id]: userAccess,
      },
    },
    contributors: [
      {
        id: user.id,
        name: interpolateString(strings["contributor{index}"], { index: "1" }),
      },
      {
        id: crypto.randomUUID(),
        name: interpolateString(strings["contributor{index}"], { index: "2" }),
      },
    ],
    id: crypto.randomUUID(),
    items: [
      {
        buyer: 0,
        cost: 3000,
        name: interpolateString(strings["item{index}"], { index: "1" }),
        split: [1, 2],
      },
      {
        buyer: 1,
        cost: 1000,
        name: interpolateString(strings["item{index}"], { index: "2" }),
        split: [1, 1],
      },
    ],
    name: interpolateString(strings["bill{date}"], {
      date: DATE_FORMATTER.format(new Date()),
    }),
    updatedAt: Date.now(),
  };
};

export const createBillClient = async (
  strings: LocalizedStrings,
  userId: AppUser["id"],
) => {
  const { get: user, set: setUser } = await getUser(userId);
  if (user) {
    try {
      const response = await fetch("/bills", {
        body: JSON.stringify({ user }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (response.ok) {
        const billData = await response.json();
        console.log(billData);
        await Promise.all([
          setUser({ bills: user.bills.concat(billData.id) }),
          idb?.put("bills", billData),
        ]);
        goto(`/bills/${billData.id}`);
      }
    } catch (err) {
      console.log(err);
      const billData = initializeBill(strings, user);
      await Promise.all([
        setUser({ bills: user.bills.concat(billData.id) }),
        idb?.put("bills", billData),
      ]);
      goto(`/bills/${billData.id}`);
    }
  }
};
