import { error, json } from "@sveltejs/kit";

/**
 * Single-bill fetch for cold-start hydration (BillState.ensureLoaded). Returns the
 * nested server shape; the client flattens it via flattenServerBill. RLS scopes
 * readability — a non-member of a private bill gets no row → 404.
 */
export async function GET({ params, locals }) {
  const { supabase, safeGetSession } = locals;
  const { session, user } = await safeGetSession();
  if (!session || !user) {
    throw error(401, "Unauthorized");
  }

  const { data: bill, error: billError } = await supabase
    .from("bills")
    .select("*, bill_users(*), bill_items(*, bill_item_splits(*)), bill_contributors(*)")
    .eq("id", params.billId)
    .order("sort", { ascending: true, referencedTable: "bill_items" })
    .order("sort", { ascending: true, referencedTable: "bill_contributors" })
    .single();

  if (billError || !bill) {
    throw error(404, "Bill not found");
  }

  // RLS already enforces this; an explicit check keeps the contract obvious.
  const isMember = bill.bill_users.some((u) => u.user_id === user.id);
  if (!isMember && bill.visibility !== "public_read") {
    throw error(403, "Access Denied");
  }

  return json(bill);
}
