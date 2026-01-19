import { goto } from "$app/navigation";
import { signInAnonymously } from "$lib/utils/common/auth.svelte";
import { type IAppState } from "$lib/utils/common/context.svelte";
import { DATE_FORMATTER } from "$lib/utils/common/formatter";
import { idb } from "$lib/utils/common/indexedDb.svelte";
import {
  type LocalizedStrings,
  interpolateString,
} from "$lib/utils/common/locale";
import type { Database } from "$lib/utils/models/database";
import { type ISyncState, createMutation } from "$lib/utils/models/sync.svelte";
import {
  type IUserState,
  type UserData,
  updateUser,
} from "$lib/utils/models/user.svelte";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BillDB = Database["public"]["Tables"]["bills"]["Row"];
export type BillContributorDB =
  Database["public"]["Tables"]["bill_contributors"]["Row"];
export type BillItemDB = Database["public"]["Tables"]["bill_items"]["Row"];
export type BillItemSplitDB =
  Database["public"]["Tables"]["bill_item_splits"]["Row"];
export type BillUserDB = Database["public"]["Tables"]["bill_users"]["Row"];

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

export interface IBillState {
  readonly data: BillData[] | null;
  readonly initialized: boolean;
  delete(id: string): Promise<void>;
  update(newBillData: BillData): Promise<BillData[] | undefined>;
}

export class BillState implements IBillState {
  #data = $state<IBillState["data"]>(null);
  #initialized = $state(false);

  constructor(getBillIds: () => string[] | undefined) {
    $effect(() => {
      const billIds = getBillIds();
      if (billIds?.length) {
        this.#initialized = false;
        this.#initialize(billIds);
      } else {
        this.#data = [];
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

  async #initialize(billIds: string[]) {
    const bills = await idb?.getAll<BillData>("bills", billIds);
    if (bills) {
      this.#data = bills;
    }
    this.#initialized = true;
  }

  async update(newBillData: BillData) {
    if (!this.#data) return;

    const index = this.#data.findIndex((bill) => bill.id === newBillData.id);
    if (index !== -1) {
      this.#data[index] = newBillData;
    } else {
      this.#data.push(newBillData);
    }

    await idb?.put("bills", JSON.parse(JSON.stringify(newBillData)));
    return this.#data;
  }

  async delete(id: string) {
    if (!this.#data) return;
    const index = this.#data.findIndex((bill) => bill.id === id);
    if (index !== -1) {
      this.#data.splice(index, 1);
    }
    await idb?.delete("bills", id);
  }
}

export const initializeBill = (
  strings: LocalizedStrings,
  user: UserData,
  billData?:
    | {
        contributors: BillContributorDB[];
        items: BillItemDB[];
        main: BillDB;
        split: BillItemSplitDB[];
      }
    | string,
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

  const billId = billData ?? crypto.randomUUID();
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
  supabase: SupabaseClient,
  strings: LocalizedStrings,
  userState: IUserState,
  syncState: ISyncState,
  billState?: IBillState,
) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let user = userState.data;
  if (!session) {
    user = await signInAnonymously(supabase, userState);
  }

  if (user && billState) {
    const billData = initializeBill(strings, user);
    const mutation = createMutation(
      "CREATE_BILL",
      { bill: billData },
      billData.id,
      user.id,
    );
    await Promise.all([
      userState.update({ bills: user.bills.concat(billData.id) }),
      billState.update(billData),
      syncState.push(mutation),
    ]);
    goto(`/bills/${billData.id}`);
  }
};

export const addItem = async (
  app: IAppState,
  billData: BillData,
  payload: { item: BillItemDB; splits: BillItemSplitDB[] },
) => {
  const { bills, sync, user } = app;
  const userId = user.data?.id;
  if (!userId) return;

  billData.bill_items.push({
    ...payload.item,
    bill_item_splits: payload.splits,
  });
  const mutation = createMutation("ADD_ITEM", payload, billData.id, userId);
  await Promise.all([bills.update(billData), sync.push(mutation)]);
};

export const updateItem = async (
  app: IAppState,
  billData: BillData,
  payload: { id: string } & Partial<BillItemDB>,
) => {
  const { bills, sync, user } = app;
  const userId = user.data?.id;
  if (!userId) return;

  const item = billData.bill_items.find((i) => i.id === payload.id);
  if (item) {
    if (payload.name !== undefined) item.name = payload.name;
    if (payload.cost !== undefined) item.cost = payload.cost;
    if (payload.contributor_id !== undefined)
      item.contributor_id = payload.contributor_id;

    const mutation = createMutation(
      "UPDATE_ITEM",
      payload,
      billData.id,
      userId,
    );
    await Promise.all([bills.update(billData), sync.push(mutation)]);
  }
};

export const deleteItem = async (
  app: IAppState,
  billData: BillData,
  itemId: string,
) => {
  const { bills, sync, user } = app;
  const userId = user.data?.id;
  if (!userId) return;

  const index = billData.bill_items.findIndex((i) => i.id === itemId);
  if (index !== -1) {
    billData.bill_items.splice(index, 1);
    const mutation = createMutation(
      "DELETE_ITEM",
      { id: itemId },
      billData.id,
      userId,
    );
    await Promise.all([bills.update(billData), sync.push(mutation)]);
  }
};

export const addContributor = async (
  app: IAppState,
  billData: BillData,
  payload: { contributor: BillContributorDB; splits: BillItemSplitDB[] },
) => {
  const { bills, sync, user } = app;
  const userId = user.data?.id;
  if (!userId) return;

  billData.bill_contributors.push(payload.contributor);
  // Add splits to items in local state
  payload.splits.forEach((split) => {
    const item = billData.bill_items.find((i) => i.id === split.item_id);
    if (item) {
      item.bill_item_splits.push(split);
    }
  });

  const mutation = createMutation(
    "ADD_CONTRIBUTOR",
    payload,
    billData.id,
    userId,
  );
  await Promise.all([bills.update(billData), sync.push(mutation)]);
};

export const updateContributorName = async (
  app: IAppState,
  billData: BillData,
  payload: { id: string; name: string },
) => {
  const { bills, sync, user } = app;
  const userId = user.data?.id;
  if (!userId) return;

  const contributor = billData.bill_contributors.find(
    (c) => c.id === payload.id,
  );
  if (contributor) {
    contributor.name = payload.name;
    const mutation = createMutation(
      "UPDATE_CONTRIBUTOR",
      { id: payload.id, name: payload.name },
      billData.id,
      userId,
    );
    await Promise.all([bills.update(billData), sync.push(mutation)]);
  }
};

export const deleteContributor = async (
  app: IAppState,
  billData: BillData,
  payload: { contributorId: string; reassignToId: string },
) => {
  const { bills, sync, user } = app;
  const userId = user.data?.id;
  if (!userId) return;

  const index = billData.bill_contributors.findIndex(
    (c) => c.id === payload.contributorId,
  );
  if (index !== -1) {
    // Local Update
    billData.bill_contributors.splice(index, 1);
    billData.bill_items.forEach((item) => {
      if (item.contributor_id === payload.contributorId) {
        item.contributor_id = payload.reassignToId;
      }
      const splitIndex = item.bill_item_splits.findIndex(
        (s) => s.contributor_id === payload.contributorId,
      );
      if (splitIndex !== -1) {
        item.bill_item_splits.splice(splitIndex, 1);
      }
    });

    const mutation = createMutation(
      "DELETE_CONTRIBUTOR",
      payload,
      billData.id,
      userId,
    );
    await Promise.all([bills.update(billData), sync.push(mutation)]);
  }
};

export const updateSplitRatio = async (
  app: IAppState,
  split: BillItemSplitDB,
  billData: BillData,
  ratio: number,
) => {
  const { bills, sync, user } = app;
  const userId = user.data?.id;
  if (!userId) return;

  split.ratio = ratio;
  const mutation = createMutation(
    "UPDATE_SPLIT",
    { id: split.id, ratio },
    billData.id,
    userId,
  );
  await Promise.all([bills.update(billData), sync.push(mutation)]);
};

export const linkContributorAccount = async (
  app: IAppState,
  billData: BillData,
  payload: {
    oldContributorId: string;
    newUserId: string;
    userInfo?: Partial<UserData>;
  },
) => {
  const { bills, sync, user } = app;
  const userId = user.data?.id;
  if (!userId) return;

  const contributor = billData.bill_contributors.find(
    (c) => c.id === payload.oldContributorId,
  );
  if (contributor) {
    contributor.id = payload.newUserId;
    // Update all references
    billData.bill_items.forEach((item) => {
      if (item.contributor_id === payload.oldContributorId) {
        item.contributor_id = payload.newUserId;
      }
      const split = item.bill_item_splits.find(
        (s) => s.contributor_id === payload.oldContributorId,
      );
      if (split) {
        split.contributor_id = payload.newUserId;
      }
    });

    // Update bill_user if info provided
    if (payload.userInfo) {
      const billUser = billData.bill_users.find(
        (u) => u.user_id === payload.oldContributorId,
      );
      if (billUser) {
        billUser.user_id = payload.newUserId;
        if (payload.userInfo.default_payment_id)
          billUser.payment_id = payload.userInfo.default_payment_id;
        if (payload.userInfo.default_payment_method)
          billUser.payment_method = payload.userInfo.default_payment_method;
      }
    }

    const mutation = createMutation(
      "UPDATE_CONTRIBUTOR",
      {
        id: payload.oldContributorId,
        new_user_id: payload.newUserId,
        ...payload.userInfo,
      },
      billData.id,
      userId,
    );
    await Promise.all([bills.update(billData), sync.push(mutation)]);
  }
};

export const updateUserPayment = async (
  app: IAppState,
  billData: BillData,
  payload: {
    userId: string;
    paymentId?: string;
    paymentMethod?: BillUserDB["payment_method"];
  },
) => {
  const { bills, sync, user } = app;
  const userId = user.data?.id;
  if (!userId) return;

  const billUser = billData.bill_users.find(
    (u) => u.user_id === payload.userId,
  );
  if (billUser) {
    if (payload.paymentId !== undefined)
      billUser.payment_id = payload.paymentId;
    if (payload.paymentMethod !== undefined)
      billUser.payment_method = payload.paymentMethod;

    const mutation = createMutation(
      "UPDATE_CONTRIBUTOR",
      { ...payload, is_bill_user: true },
      billData.id,
      userId,
    );
    await Promise.all([bills.update(billData), sync.push(mutation)]);

    // Update user defaults if relevant
    const userUpdate: Partial<UserData> = {};
    if (payload.paymentId) userUpdate.default_payment_id = payload.paymentId;
    if (payload.paymentMethod)
      userUpdate.default_payment_method = payload.paymentMethod;

    if (Object.keys(userUpdate).length > 0) {
      await updateUser(userUpdate);
    }
  }
};

export const updateBill = async (
  app: IAppState,
  billData: BillData,
  payload: Partial<Pick<BillDB, "name" | "invite_id" | "invite_required">>,
) => {
  const { bills, sync, user } = app;
  const userId = user.data?.id;
  if (!userId) return;

  if (payload.name !== undefined) billData.name = payload.name;
  if (payload.invite_id !== undefined) billData.invite_id = payload.invite_id;
  if (payload.invite_required !== undefined)
    billData.invite_required = payload.invite_required;

  const mutation = createMutation("UPDATE_BILL", payload, billData.id, userId);
  await Promise.all([bills.update(billData), sync.push(mutation)]);
};

export const deleteBill = async (app: IAppState, billData: BillData) => {
  const { user, bills, sync } = app;
  const userId = user.data?.id;
  if (!userId) return;

  const newBills = user.data?.bills.filter((id) => id !== billData.id) ?? [];

  const mutation = createMutation("DELETE_BILL", {}, billData.id, userId);

  await Promise.all([
    user.update({ bills: newBills }),
    bills.delete(billData.id),
    sync.push(mutation),
  ]);
  goto("/");
};
