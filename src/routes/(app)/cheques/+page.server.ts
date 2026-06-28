import { getLocaleStrings } from "$lib/utils/common/locale";

export async function load({ cookies, request, locals }) {
  const { supabase, safeGetSession } = locals;
  const { session, user } = await safeGetSession();

  // Nested server shape (splits under items); the page flattens it via flattenServerCheque.
  let chequeList = null;
  if (session && user) {
    const { data } = await supabase
      .from("cheques")
      .select("*, cheque_users(*), cheque_items(*, cheque_item_splits(*)), cheque_people(*)")
      .eq("cheque_users.user_id", user.id)
      .order("sort", { ascending: true, referencedTable: "cheque_items" })
      .order("sort", { ascending: true, referencedTable: "cheque_people" });
    chequeList = data;
  }
  const { strings } = getLocaleStrings(cookies, request, [
    "account",
    "alreadyHaveChequesHint",
    "appName",
    "claimYourSpot",
    "home",
    "newCheque",
    "next",
    "noChequesYet",
    "owner",
    "plus{count}More",
    "previous",
    "signInWithGoogle",
    "startACheque",
    "startYourFirstCheque",
    "total",
    "yourCheques",
    "youOwe",
    "youreOwed",
  ]);
  return {
    chequeList,
    strings,
  };
}
