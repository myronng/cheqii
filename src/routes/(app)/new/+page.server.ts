import { getLocaleStrings } from "$lib/utils/common/locale";

// `/new` is the landing's "Start A Cheque" target: it creates a bill for the
// current user (or an anonymous one) and redirects into the editor. No auth
// gate — an unauthenticated visitor gets an anonymous account on the client.
export async function load({ cookies, request }) {
  const { strings } = getLocaleStrings(cookies, request, [
    "appName",
    "bill{date}",
    "contributor{index}",
    "item{index}",
    "startingYourCheque",
  ]);

  return { strings };
}
