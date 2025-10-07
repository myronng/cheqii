import type { BillData } from "$lib/utils/common/bill.svelte.ts";

import { getLocaleStrings } from "$lib/utils/common/locale";
import { redirect } from "@sveltejs/kit";

import { MOCK_BILL_DATA_COMPLEX } from "../../../../tests/mockData";

export async function load({ cookies, params, parent, request, url }) {
  const userId = (await parent()).userId;
  const inviteId = cookies.get(params.id);
  const { strings } = getLocaleStrings(cookies, request, [
    "addContributor",
    "addItem",
    "anonymous",
    "anyoneOnTheInternetCanAccessThisBill",
    "balance",
    "balanceCalculation{subtrahend}{minuend}",
    "buyer",
    "bill",
    "bill{date}",
    "billName",
    "cheqii",
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
  let bill: BillData | null = null;
  // TODO: Get bill from server if available
  if (Math.random() > 200) {
    bill = MOCK_BILL_DATA_COMPLEX;
  }
  if (bill) {
    // If private + not invited, redirect to home
    if (
      !bill.access.invite.required &&
      inviteId !== bill.access.invite.id &&
      userId &&
      !bill.access.users[userId]
    ) {
      redirect(307, "/");
    }
  }
  if (inviteId) {
    cookies.delete(params.id, { path: "/" });
  }
  return {
    bill,
    billId: params.id,
    invited: bill && inviteId === bill.access.invite.id,
    origin: url.origin,
    strings,
  };
}
