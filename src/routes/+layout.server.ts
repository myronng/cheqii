import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({
  cookies,
  locals: { supabase },
}) => {
  /**
   * The user ID cookie stores the active session. It cannot use `httpOnly` since
   * offline mode necessitates CSR (i.e. no HTTP request)
   */
  const cookieUserId = cookies.get("userId");
  const sessionUserId = (await supabase.auth.getUser()).data.user?.id;
  if (sessionUserId && cookieUserId && sessionUserId !== cookieUserId) {
    cookies.set("userId", sessionUserId, {
      path: "/",
    });
    // TODO: Merge user data
  }
  if (!cookieUserId) {
    const userId = sessionUserId ?? crypto.randomUUID();
    cookies.set("userId", userId, {
      path: "/",
    });
  }

  return {
    cookies: cookies.getAll(),
  };
};

export const ssr = false;
