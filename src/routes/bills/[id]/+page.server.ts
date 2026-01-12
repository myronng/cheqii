import { getLocaleStrings } from "$lib/utils/common/locale";
import { type BillData } from "$lib/utils/models/bill.svelte";
import { redirect } from "@sveltejs/kit";

export async function load({ cookies, locals, params, request, url }) {
  const inviteId = cookies.get(params.id);
  const { strings } = getLocaleStrings(cookies, request, [
    "addContributor",
    "addItem",
    "anonymous",
    "anyoneOnTheInternetCanAccessThisBill",
    "appName",
    "balance",
    "balanceCalculation{subtrahend}{minuend}",
    "buyer",
    "bill",
    "bill{date}",
    "billName",
    "close",
    "contributor{index}",
    "cost",
    "deleteBill",
    "downloadCsv",
    "etransfer",
    "exportBillDataToUseInOtherApplications",
    "home",
    "invited",
    "inviteLink",
    "item",
    "{item}Buyer",
    "{item}ContributionFrom{contributor}",
    "{item}Cost",
    "item{index}",
    "leaveBill",
    "linkPaymentAccountTo{payee}",
    "notLinked",
    "onlyInvitedUsersCanAccessThisBill",
    "owing",
    "owingCalculation{multiplicand}{numerator}{denominator}",
    "owner",
    "paid",
    "{payer}Sends{payee}{value}",
    "paymentId",
    "paymentMethod",
    "payPal",
    "private",
    "public",
    "regenerateInviteLink",
    "remove{item}",
    "settings",
    "share",
    "subtotal",
    "theCurrentInvitationLinkWillNoLongerWork",
    "thisWillDeleteTheBillForAllUsers",
    "total",
    "{user}(you)",
    "{user}HasNoPaymentAccountSetUp",
    "users",
    "{value}UnaccountedFor",
    "youWillNotBeAbleToAccessThisBillAnymore",
  ]);

  const { supabase, safeGetSession } = locals;
  const { session, user } = await safeGetSession();

  if (!session || !user) {
    throw new Error("Unauthorized");
  }

  const { data: fetchedUserData, error: userError } = await supabase
    .from("users")
    .select("*, bill_users(*)")
    .eq("id", user.id)
    .single();

  if (userError) {
    throw new Error("Error fetching user data:" + userError.message);
  }

  const { data: bill, error: billError } = await supabase.rpc<
    "get_full_bill",
    { p_bill_id: string },
    {
      Row: never;
      Return: BillData | null;
      RelationName: "get_full_bill";
      Result: BillData | null;
      Relationships: null;
    }
  >("get_full_bill", { p_bill_id: params.id });

  if (billError || !bill) {
    throw new Error(
      "Error fetching bill data:" + (billError?.message || "Not found")
    );
  }

  // If private + not invited, redirect to home
  if (
    bill.invite_required &&
    inviteId !== bill.invite_id &&
    !fetchedUserData.bill_users.some((bu) => bu.bill_id === bill.id)
  ) {
    redirect(307, "/");
  }

  if (inviteId) {
    cookies.delete(params.id, { path: "/" });
  }
  return {
    bill,
    invited: bill && inviteId === bill.invite_id,
    origin: url.origin,
    strings,
  };
}
