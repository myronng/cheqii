import { error, json } from "@sveltejs/kit";

/**
 * Single-cheque fetch for cold-start hydration (ChequeState.ensureLoaded). Returns the
 * nested server shape; the client flattens it via flattenServerCheque. RLS scopes
 * readability — a non-member of a private cheque gets no row → 404.
 */
export async function GET({ params, locals }) {
  const { supabase, safeGetSession } = locals;
  const { session, user } = await safeGetSession();
  if (!session || !user) {
    throw error(401, "Unauthorized");
  }

  const { data: cheque, error: chequeError } = await supabase
    .from("cheques")
    .select("*, cheque_users(*), cheque_items(*, cheque_item_splits(*)), cheque_people(*)")
    .eq("id", params.chequeId)
    .order("sort", { ascending: true, referencedTable: "cheque_items" })
    .order("sort", { ascending: true, referencedTable: "cheque_people" })
    .single();

  if (chequeError || !cheque) {
    throw error(404, "Cheque not found");
  }

  // RLS already enforces this; an explicit check keeps the contract obvious.
  const isMember = cheque.cheque_users.some((u) => u.user_id === user.id);
  if (!isMember && cheque.visibility !== "public_read") {
    throw error(403, "Access Denied");
  }

  return json(cheque);
}
