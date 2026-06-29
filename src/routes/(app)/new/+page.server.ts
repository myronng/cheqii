import { getLocaleStrings } from "$lib/utils/common/locale";

// `/new` is the landing's "Start A Cheque" target: it creates a cheque for the
// current user (or an anonymous one) and redirects into the editor. No auth
// gate — an unauthenticated visitor gets an anonymous account on the client.
export async function load({ cookies, request }) {
  const { strings } = getLocaleStrings(cookies, request, [
    "appName",
    "cheque{date}",
    "person{index}",
    "item{index}",
    "startingYourCheque",
    "guestChequeLimitTitle",
    "guestChequeLimitBody",
    "continueWithGoogle",
    "backToYourCheques",
  ]);

  return { strings };
}
