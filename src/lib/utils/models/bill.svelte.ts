import { goto } from "$app/navigation";
import { DATE_FORMATTER } from "$lib/utils/common/formatter";
import { idb } from "$lib/utils/common/indexedDb.svelte";
import {
  type LocalizedStrings,
  interpolateString,
} from "$lib/utils/common/locale";
import { type AppUser, getUser } from "$lib/utils/models/user.svelte";
import type { Database } from "./database";

type BillDB = Database["public"]["Tables"]["bills"]["Row"];
type BillContributorDB =
  Database["public"]["Tables"]["bill_contributors"]["Row"];
type BillItemDB = Database["public"]["Tables"]["bill_items"]["Row"];
type BillItemSplitDB = Database["public"]["Tables"]["bill_item_splits"]["Row"];
type BillUserDB = Database["public"]["Tables"]["bill_users"]["Row"];

export type BillAuthority = BillUserDB["authority"];

export type BillData = BillDB & {
  bill_contributors: BillContributorDB[];
  bill_items: (BillItemDB & {
    bill_item_splits: BillItemSplitDB[];
  })[];
  bill_users: BillUserDB[];
};

export type OnBillChange = (billData: BillData) => Promise<void>;

export const INVITE_ACCESS = new Set(["invited", "owner"]);

export const initializeBill = (
  strings: LocalizedStrings,
  user: AppUser,
  billData?:
    | {
        contributors: BillContributorDB[];
        items: BillItemDB[];
        main: BillDB;
        split: BillItemSplitDB[];
      }
    | string
): BillData => {
  const currentDate = new Date();
  const currentTimestamp = currentDate.toISOString();

  if (typeof billData === "object") {
    return {
      bill_contributors: billData.contributors.map((contributor) => ({
        bill_id: billData.main.id,
        id: contributor.id,
        name: contributor.name,
        sort: contributor.sort,
        updated_at: contributor.updated_at,
      })),
      bill_items: billData.items.map((item) => ({
        bill_id: billData.main.id,
        bill_item_splits: billData.split.map((split) => ({
          bill_id: billData.main.id,
          contributor_id: split.contributor_id,
          id: split.id,
          item_id: split.item_id,
          ratio: split.ratio,
          updated_at: split.updated_at,
        })),
        contributor_id: item.contributor_id,
        cost: item.cost,
        id: item.id,
        name: item.name,
        sort: item.sort,
        updated_at: item.updated_at,
      })),
      bill_users: [
        {
          authority: "owner",
          bill_id: billData.main.id,
          payment_id: null,
          payment_method: null,
          updated_at: billData.main.updated_at,
          user_id: user.id,
        },
      ],
      id: billData.main.id,
      invite_id: billData.main.invite_id,
      invite_required: billData.main.invite_required,
      name: billData.main.name,
      updated_at: billData.main.updated_at,
    };
  }

  const billId = crypto.randomUUID();
  const firstItemId = crypto.randomUUID();
  const secondItemId = crypto.randomUUID();
  const secondContributorId = crypto.randomUUID();

  return {
    bill_contributors: [
      {
        bill_id: billId,
        id: user.id,
        name: interpolateString(strings["contributor{index}"], { index: "1" }),
        sort: 0,
        updated_at: currentTimestamp,
      },
      {
        bill_id: billId,
        id: secondContributorId,
        name: interpolateString(strings["contributor{index}"], { index: "2" }),
        sort: 1,
        updated_at: currentTimestamp,
      },
    ],
    bill_items: [
      {
        bill_id: billId,
        bill_item_splits: [
          {
            bill_id: billId,
            contributor_id: user.id,
            id: crypto.randomUUID(),
            item_id: firstItemId,
            ratio: 1,
            updated_at: currentTimestamp,
          },
          {
            bill_id: billId,
            contributor_id: secondContributorId,
            id: crypto.randomUUID(),
            item_id: firstItemId,
            ratio: 2,
            updated_at: currentTimestamp,
          },
        ],
        contributor_id: user.id,
        cost: 3000,
        id: firstItemId,
        name: interpolateString(strings["item{index}"], { index: "1" }),
        sort: 0,
        updated_at: currentTimestamp,
      },
      {
        bill_id: billId,
        bill_item_splits: [
          {
            bill_id: billId,
            contributor_id: user.id,
            id: crypto.randomUUID(),
            item_id: secondItemId,
            ratio: 1,
            updated_at: currentTimestamp,
          },
          {
            bill_id: billId,
            contributor_id: secondContributorId,
            id: crypto.randomUUID(),
            item_id: secondItemId,
            ratio: 1,
            updated_at: currentTimestamp,
          },
        ],
        contributor_id: secondContributorId,
        cost: 1000,
        id: secondItemId,
        name: interpolateString(strings["item{index}"], { index: "2" }),
        sort: 1,
        updated_at: currentTimestamp,
      },
    ],
    bill_users: [
      {
        authority: "owner",
        bill_id: billId,
        payment_id: user.default_payment_id,
        payment_method: user.default_payment_method,
        updated_at: currentTimestamp,
        user_id: user.id,
      },
    ],
    id: billId,
    invite_id: crypto.randomUUID(),
    invite_required: true,
    name: interpolateString(strings["bill{date}"], {
      date: DATE_FORMATTER.format(currentDate),
    }),
    updated_at: currentTimestamp,
  };
};

export const createBill = async (
  strings: LocalizedStrings,
  userId: AppUser["id"]
) => {
  const { get: user, set: setUser } = await getUser(userId);
  if (user) {
    // Try network first and fallback to local create
    try {
      const response = await fetch("/bills", {
        body: JSON.stringify({ user }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (response.ok) {
        const billData = await response.json();
        await Promise.all([
          setUser({ bills: user.bills.concat(billData.id) }),
          idb?.put("bills", billData),
        ]);
        goto(`/bills/${billData.id}`);
      } else {
        throw new Error(await response.text());
      }
    } catch {
      const billData = initializeBill(strings, user);
      await Promise.all([
        setUser({ bills: user.bills.concat(billData.id) }),
        idb?.put("bills", billData),
      ]);
      goto(`/bills/${billData.id}`);
    }
  }
};
