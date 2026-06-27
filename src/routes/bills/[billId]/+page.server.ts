import { getLocaleStrings } from "$lib/utils/common/locale";
import { redirect } from "@sveltejs/kit";

export async function load({ cookies, locals, params, request, url }) {
  const { safeGetSession } = locals;
  const { session, user } = await safeGetSession();

  if (!session || !user) {
    cookies.set("authRedirect", url.pathname, { path: "/", maxAge: 60 * 5 }); // 5 minutes
    redirect(307, "/auth");
  }

  const { strings } = getLocaleStrings(cookies, request, [
    "addContributor",
    "addItem",
    "anonymous",
    "account",
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
    "offline",
    "subtotal",
    "syncError",
    "synced",
    "syncing",
    "theCurrentInvitationLinkWillNoLongerWork",
    "thisWillDeleteTheBillForAllUsers",
    "total",
    "unsyncedChanges",
    "{user}(you)",
    "{user}HasNoPaymentAccountSetUp",
    "users",
    "{value}UnaccountedFor",
    "youWillNotBeAbleToAccessThisBillAnymore",
  ]);

  return {
    billId: params.billId,
    origin: url.origin,
    strings,
  };
}
