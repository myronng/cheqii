import { redirect } from "@sveltejs/kit";

export function load({ cookies, params }) {
  cookies.set(params.billId, params.inviteId, {
    path: "/",
  });

  redirect(307, `/bills/${params.billId}`);
}
