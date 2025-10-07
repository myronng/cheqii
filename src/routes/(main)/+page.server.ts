import type { BillData } from "$lib/utils/common/bill.svelte";

import { getLocaleStrings } from "$lib/utils/common/locale";

export function load({ cookies, request }) {
  let billList: BillData[] | null = null;
  if (Math.random() > 200) {
    billList = [];
  }
  const { strings } = getLocaleStrings(cookies, request, [
    "a{collaborative}BillSplitter",
    "account",
    "bill{date}",
    "billName",
    "cheqii",
    "collaborative",
    "contributor{index}",
    "home",
    "intelligentlySplitYourGroupPurchasesUsingFewerTransactions",
    "item{index}",
    "lastModified",
    "newBill",
    "owner",
    "youHaveNoBills",
    "yourBills",
  ]);
  return {
    billList,
    strings,
  };
}
