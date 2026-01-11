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
  const userId =
    (await supabase.auth.getUser()).data.user?.id ?? crypto.randomUUID();
  if (userId && cookieUserId && userId !== cookieUserId) {
    /**
     * Don't set `httpOnly because offline users must be able to get userId`
     */
    cookies.set("userId", userId, {
      path: "/",
    });
    // TODO: Merge user data
  }
  if (!cookieUserId) {
    cookies.set("userId", userId, {
      path: "/",
    });
  }

  return {
    cookies: cookies.getAll(),
    userId,
  };
};

export const ssr = false;
