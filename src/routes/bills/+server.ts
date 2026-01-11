import type { RequestHandler } from "./$types";

import { getLocaleStrings } from "$lib/utils/common/locale";
import { initializeBill } from "$lib/utils/models/bill.svelte";
import { initializeUser } from "$lib/utils/models/user.svelte";
import { json } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ cookies, request, locals }) => {
  const { supabase, safeGetSession } = locals;
  const { session, user } = await safeGetSession();

  if (!session || !user) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
    });
  }

  const { strings } = getLocaleStrings(cookies, request, [
    "bill{date}",
    "contributor{index}",
    "item{index}",
  ]);

  const { data: fetchedUserData, error: userError } = await supabase
    .from("users")
    .select("*, bill_users(*)")
    .eq("id", user.id)
    .single();

  if (userError) {
    throw new Error("Error fetching user data:", userError);
  } else {
    const userData = initializeUser(fetchedUserData);
    const newBillData = initializeBill(strings, userData, crypto.randomUUID());

    try {
      const { data: createdBill, error: rpcError } = await supabase
        .rpc("create_full_bill", {
          p_owner_uuid: user.id,
          p_bill_data: newBillData,
        })
        .single();

      if (rpcError) {
        console.error("Supabase RPC create_full_bill error:", rpcError);
        throw rpcError;
      }
      // For safety, always return the server ID in case it gets changed
      newBillData.id = createdBill.out_id;
      return json(newBillData, { status: 201 });
    } catch (error: any) {
      return json(
        { message: "Failed to create bill", error: error.message },
        { status: 500 }
      );
    }
  }
};
