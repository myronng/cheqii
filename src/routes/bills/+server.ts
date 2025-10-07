import type { RequestHandler } from "./$types";

import { initializeBill } from "$lib/utils/common/bill.svelte";
import { getLocaleStrings } from "$lib/utils/common/locale";
import { json } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ cookies, request }) => {
  const { user } = await request.json();
  const { strings } = getLocaleStrings(cookies, request, [
    "bill{date}",
    "contributor{index}",
    "item{index}",
  ]);
  const bill = initializeBill(strings, user);
  return json(bill);
};
