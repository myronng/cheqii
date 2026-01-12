import type { Allocations } from "$lib/utils/common/allocate";
import type { BillData } from "$lib/utils/models/bill.svelte";
import { vi } from "vitest";

const UPDATED_AT = "2024-10-05T18:23:50.389Z";

const ALICE_ID = "f45081b6-a631-4b83-8098-81ebce287915";
const BOB_ID = "0a22ebec-daea-4b99-b6bf-0e5063a5dc14";
const CLEO_ID = "89d40d47-b298-4402-9a2a-f67ac6ad6795";
const DAVE_ID = "314f1654-9d4f-4d78-bd58-c568de938122";
const EVE_ID = "5ce8a4e8-029a-49d9-a121-bb3f97b54b70";

const BILL_ID_COMPLEX = "0c5eda25-6808-472a-83a5-18ec58f56d70";
const BILL_ID_SIMPLE = "1c5eda25-6808-472a-83a5-18ec58f56d71";

const createSplits = (
  billId: string,
  itemId: string,
  contributorIds: string[],
  ratios: number[]
) =>
  contributorIds.map((contributorId, index) => ({
    bill_id: billId,
    contributor_id: contributorId,
    id: crypto.randomUUID(),
    item_id: itemId,
    ratio: ratios[index] ?? 0,
    updated_at: UPDATED_AT,
  }));

export const MOCK_BILL_DATA_COMPLEX: BillData = {
  bill_contributors: [
    {
      bill_id: BILL_ID_COMPLEX,
      id: ALICE_ID,
      name: "Alice",
      sort: 0,
      updated_at: UPDATED_AT,
    },
    {
      bill_id: BILL_ID_COMPLEX,
      id: BOB_ID,
      name: "Bob",
      sort: 1,
      updated_at: UPDATED_AT,
    },
    {
      bill_id: BILL_ID_COMPLEX,
      id: CLEO_ID,
      name: "Cleo",
      sort: 2,
      updated_at: UPDATED_AT,
    },
    {
      bill_id: BILL_ID_COMPLEX,
      id: DAVE_ID,
      name: "Dave",
      sort: 3,
      updated_at: UPDATED_AT,
    },
  ],
  bill_items: [
    {
      bill_id: BILL_ID_COMPLEX,
      bill_item_splits: createSplits(
        BILL_ID_COMPLEX,
        "item-1",
        [ALICE_ID, BOB_ID, CLEO_ID, DAVE_ID],
        [1, 1, 1, 2]
      ),
      contributor_id: ALICE_ID,
      cost: 600,
      id: "item-1",
      name: "Test item 1",
      sort: 0,
      updated_at: UPDATED_AT,
    },
    {
      bill_id: BILL_ID_COMPLEX,
      bill_item_splits: createSplits(
        BILL_ID_COMPLEX,
        "item-2",
        [ALICE_ID, BOB_ID, CLEO_ID, DAVE_ID],
        [1, 1, 0, 1]
      ),
      contributor_id: BOB_ID,
      cost: 362,
      id: "item-2",
      name: "Test item 2",
      sort: 1,
      updated_at: UPDATED_AT,
    },
    {
      bill_id: BILL_ID_COMPLEX,
      bill_item_splits: createSplits(
        BILL_ID_COMPLEX,
        "item-3",
        [ALICE_ID, BOB_ID, CLEO_ID, DAVE_ID],
        [1, 1, 1, 1]
      ),
      contributor_id: ALICE_ID,
      cost: 403,
      id: "item-3",
      name: "Test item 3",
      sort: 2,
      updated_at: UPDATED_AT,
    },
    {
      bill_id: BILL_ID_COMPLEX,
      bill_item_splits: createSplits(
        BILL_ID_COMPLEX,
        "item-4",
        [ALICE_ID, BOB_ID, CLEO_ID, DAVE_ID],
        [1, 1, 0, 1]
      ),
      contributor_id: BOB_ID,
      cost: 303,
      id: "item-4",
      name: "Test item 4",
      sort: 3,
      updated_at: UPDATED_AT,
    },
    {
      bill_id: BILL_ID_COMPLEX,
      bill_item_splits: createSplits(
        BILL_ID_COMPLEX,
        "item-5",
        [ALICE_ID, BOB_ID, CLEO_ID, DAVE_ID],
        [0, 2, 1, 1]
      ),
      contributor_id: BOB_ID,
      cost: 403,
      id: "item-5",
      name: "Test item 5",
      sort: 4,
      updated_at: UPDATED_AT,
    },
    {
      bill_id: BILL_ID_COMPLEX,
      bill_item_splits: createSplits(
        BILL_ID_COMPLEX,
        "item-6",
        [ALICE_ID, BOB_ID, CLEO_ID, DAVE_ID],
        [2, 0, 1, 1]
      ),
      contributor_id: ALICE_ID,
      cost: 403,
      id: "item-6",
      name: "Test item 6",
      sort: 5,
      updated_at: UPDATED_AT,
    },
  ],
  bill_users: [
    {
      authority: "public",
      bill_id: BILL_ID_COMPLEX,
      payment_id: "al@email.ca",
      payment_method: "etransfer",
      updated_at: UPDATED_AT,
      user_id: ALICE_ID,
    },
    {
      authority: "owner",
      bill_id: BILL_ID_COMPLEX,
      payment_id: "",
      payment_method: "etransfer",
      updated_at: UPDATED_AT,
      user_id: DAVE_ID,
    },
    {
      authority: "public",
      bill_id: BILL_ID_COMPLEX,
      payment_id: "",
      payment_method: "etransfer",
      updated_at: UPDATED_AT,
      user_id: EVE_ID,
    },
  ],
  id: BILL_ID_COMPLEX,
  invite_id: "dd77b021-d918-4fe6-9136-c6f373dcb833",
  invite_required: true,
  name: "Test bill complex",
  updated_at: UPDATED_AT,
};

export const MOCK_BILL_DATA_SIMPLE: BillData = {
  bill_contributors: [
    {
      bill_id: BILL_ID_SIMPLE,
      id: ALICE_ID,
      name: "Alice",
      sort: 0,
      updated_at: UPDATED_AT,
    },
    {
      bill_id: BILL_ID_SIMPLE,
      id: BOB_ID,
      name: "Bob",
      sort: 1,
      updated_at: UPDATED_AT,
    },
  ],
  bill_items: [
    {
      bill_id: BILL_ID_SIMPLE,
      bill_item_splits: createSplits(
        BILL_ID_SIMPLE,
        "simple-item-1",
        [ALICE_ID, BOB_ID],
        [1, 1]
      ),
      contributor_id: ALICE_ID,
      cost: 201,
      id: "simple-item-1",
      name: "Test item 1",
      sort: 0,
      updated_at: UPDATED_AT,
    },
    {
      bill_id: BILL_ID_SIMPLE,
      bill_item_splits: createSplits(
        BILL_ID_SIMPLE,
        "simple-item-2",
        [ALICE_ID, BOB_ID],
        [1, 0]
      ),
      contributor_id: BOB_ID,
      cost: 100,
      id: "simple-item-2",
      name: "Test item 2",
      sort: 1,
      updated_at: UPDATED_AT,
    },
  ],
  bill_users: [
    {
      authority: "owner",
      bill_id: BILL_ID_SIMPLE,
      payment_id: "alEtransfer@email.ca",
      payment_method: "etransfer",
      updated_at: UPDATED_AT,
      user_id: ALICE_ID,
    },
    {
      authority: "invited",
      bill_id: BILL_ID_SIMPLE,
      payment_id: "boEtransfer@email.ca",
      payment_method: "etransfer",
      updated_at: UPDATED_AT,
      user_id: BOB_ID,
    },
  ],
  id: BILL_ID_SIMPLE,
  invite_id: "dd77b021-d918-4fe6-9136-c6f373dcb834",
  invite_required: false,
  name: "Test bill simple",
  updated_at: UPDATED_AT,
};

export const MOCK_ALLOCATIONS: Allocations = {
  contributions: new Map([
    [
      0, // Alice
      {
        owing: { items: [], total: 342 },
        paid: { items: [], total: 1406 },
      },
    ],
    [
      1, // Bob
      {
        owing: { items: [], total: 721 },
        paid: { items: [], total: 1068 },
      },
    ],
    [
      2, // Cleo
      {
        owing: { items: [], total: 422 },
        paid: { items: [], total: 0 },
      },
    ],
    [
      3, // Dave
      {
        owing: { items: [], total: 989 },
        paid: { items: [], total: 0 },
      },
    ],
  ]),
  grandTotal: 2474,
  owingUnaccounted: 0,
  paidUnaccounted: 0,
};

export const createMockSupabase = () => ({
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
});
