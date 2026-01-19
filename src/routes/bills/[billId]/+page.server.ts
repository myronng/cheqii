import { getLocaleStrings } from "$lib/utils/common/locale";
import { type BillData } from "$lib/utils/models/bill.svelte";
import { redirect } from "@sveltejs/kit";

export async function load({ cookies, locals, params, request, url, depends }) {
  depends("supabase:db:bills");
  const inviteId = cookies.get(params.billId);
  const authRedirect = cookies.get("authRedirect");
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
    cookies.set("authRedirect", url.pathname, { path: "/", maxAge: 60 * 5 }); // 5 minutes
    redirect(307, "/auth");
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
  >("get_full_bill", { p_bill_id: params.billId });

  // TODO: Bill on client is not the same as bill ID
  // If private + not invited, or an error, redirect to home
  if (
    billError ||
    !bill ||
    (bill.invite_required &&
      inviteId !== bill.invite_id &&
      !bill.bill_users.some((bu) => bu.user_id === user.id))
  ) {
    redirect(307, "/");
  }

  const currentBillUser = bill.bill_users.find((bu) => bu.user_id === user.id);
  let userAccess: "public" | "invited" | null = null;

  if (!bill.invite_required && !currentBillUser) {
    userAccess = "public";
  } else if (
    bill.invite_required &&
    inviteId === bill.invite_id &&
    (!currentBillUser || currentBillUser.authority === "public")
  ) {
    userAccess = "invited";
  }

  if (userAccess) {
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("default_payment_id, default_payment_method")
      .eq("id", user.id)
      .single();

    if (userDataError || !userData) {
      console.error("Failed to get user data:", userDataError);
      redirect(307, "/");
    }

    const { data: newBillUser, error: newBillUserError } = await supabase
      .from("bill_users")
      .upsert({
        bill_id: bill.id,
        user_id: user.id,
        authority: userAccess,
        payment_id: userData?.default_payment_id,
        payment_method: userData?.default_payment_method,
      })
      .select()
      .single();

    if (newBillUserError || !newBillUser) {
      console.error("Failed to join bill:", newBillUserError);
      redirect(307, "/");
    }

    if (currentBillUser) {
      Object.assign(currentBillUser, newBillUser);
    } else {
      bill.bill_users.push(newBillUser);
    }
  }

  if (inviteId) {
    cookies.delete(params.billId, { path: "/" });
  }
  if (authRedirect) {
    cookies.delete("authRedirect", { path: "/" });
  }

  return {
    bill,
    origin: url.origin,
    strings,
  };
}
