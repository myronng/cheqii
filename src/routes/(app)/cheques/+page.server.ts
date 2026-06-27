import { getLocaleStrings } from "$lib/utils/common/locale";

export async function load({ cookies, request, locals }) {
  const { supabase, safeGetSession } = locals;
  const { session, user } = await safeGetSession();

  // Nested server shape (splits under items); the page flattens it via flattenServerCheque.
  let chequeList = null;
  if (session && user) {
    const { data } = await supabase
      .from("cheques")
      .select("*, cheque_users(*), cheque_items(*, cheque_item_splits(*)), cheque_contributors(*)")
      .eq("cheque_users.user_id", user.id)
      .order("sort", { ascending: true, referencedTable: "cheque_items" })
      .order("sort", { ascending: true, referencedTable: "cheque_contributors" });
    chequeList = data;
  }
  const { strings } = getLocaleStrings(cookies, request, [
    "a{collaborative}ChequeSplitter",
    "account",
    "appName",
    "cheque{date}",
    "chequeName",
    "collaborative",
    "contributor{index}",
    "home",
    "intelligentlySplitYourGroupPurchasesUsingFewerTransactions",
    "item{index}",
    "lastModified",
    "newCheque",
    "owner",
    "signInWithGoogle",
    "youHaveNoCheques",
    "yourCheques",
  ]);
  return {
    chequeList,
    strings,
  };
}
