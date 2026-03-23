import type { BillData } from "$lib/utils/models/bill.svelte";
import { error, json } from "@sveltejs/kit";

export async function GET({ params, locals }) {
  const { supabase, safeGetSession } = locals;
  const { session, user } = await safeGetSession();

  if (!session || !user) {
    throw error(401, "Unauthorized");
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

  if (billError) {
    throw error(500, billError.message);
  }

  if (!bill) {
    throw error(404, "Bill not found");
  }

  // Security check: Only allow access if user is a member
  const isMember = bill.bill_users.some((u) => u.user_id === user.id);
  if (!isMember) {
    throw error(403, "Access Denied");
  }

  return json(bill);
}
