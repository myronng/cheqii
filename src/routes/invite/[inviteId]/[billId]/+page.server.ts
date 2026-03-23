import { error, redirect } from "@sveltejs/kit";

export async function load({ cookies, params, locals, url }) {
  const { session, user } = await locals.safeGetSession();

  // 1. Auth Check
  if (!session || !user) {
    // Save return URL (this invite link) ensuring we come back here after login
    cookies.set("authRedirect", url.pathname, { path: "/", maxAge: 60 * 5 });
    redirect(307, "/auth");
  }

  // 2. Join Bill via RPC
  const { error: rpcError } = await locals.supabase.rpc("join_bill_via_invite", {
    p_bill_id: params.billId,
    p_invite_id: params.inviteId,
    p_user_id: user.id,
  });

  if (rpcError) {
    console.error("Join bill error:", rpcError);
    // Be vague to user but log it. "Invalid invite or Bill not found"
    throw error(404, "Invalid invitation link.");
  }

  // 3. Cleanup & Redirect
  // Remove the old invite cookie if it exists (legacy cleanup)
  cookies.delete(params.billId, { path: "/" });

  // Redirect to the bill page
  redirect(307, `/bills/${params.billId}`);
}
