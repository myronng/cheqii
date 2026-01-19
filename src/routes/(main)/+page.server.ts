import type { BillData } from "$lib/utils/models/bill.svelte";

import { getLocaleStrings } from "$lib/utils/common/locale";

export async function load({ cookies, request, locals, depends }) {
  depends("supabase:db:bills");
  const { supabase, safeGetSession } = locals;
  const { session, user } = await safeGetSession();

  let billList: BillData[] | null = null;
  if (session && user) {
    const { data } = await supabase
      .from("bills")
      .select(
        "*, bill_users(*), bill_items(*, bill_item_splits(*)), bill_contributors(*)",
      )
      .eq("bill_users.user_id", user.id)
      .order("sort", { ascending: true, referencedTable: "bill_items" })
      .order("sort", { ascending: true, referencedTable: "bill_contributors" });
    billList = data;
  }
  const { strings } = getLocaleStrings(cookies, request, [
    "a{collaborative}BillSplitter",
    "account",
    "appName",
    "bill{date}",
    "billName",
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
