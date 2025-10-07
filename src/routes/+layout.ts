import {
  PUBLIC_SUPABASE_ANON_KEY,
  PUBLIC_SUPABASE_URL,
} from "$env/static/public";
import { initializeUser, type AppUser } from "$lib/utils/common/user.svelte";
import {
  createBrowserClient,
  createServerClient,
  isBrowser,
} from "@supabase/ssr";
import type { Database } from "../supabase";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
  /**
   * Declare a dependency so the layout can be invalidated, for example, on
   * session refresh.
   */
  depends("supabase:auth");

  const supabase = isBrowser()
    ? createBrowserClient<Database>(
        PUBLIC_SUPABASE_URL,
        PUBLIC_SUPABASE_ANON_KEY,
        {
          global: {
            fetch,
          },
        },
      )
    : createServerClient<Database>(
        PUBLIC_SUPABASE_URL,
        PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return data.cookies;
            },
          },
          global: {
            fetch,
          },
        },
      );

  /**
   * It's fine to use `getSession` here, because on the client, `getSession` is
   * safe, and on the server, it reads `session` from the `LayoutData`, which
   * safely checked the session using `safeGetSession`.
   */
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentUserId = data.cookies.find(
    (cookie) => cookie.name === "userId",
  )?.value;

  let user: AppUser;

  if (session?.user) {
    const { data: userData } = await supabase
      .from("users")
      .select("*, bill_users(*)")
      .eq("id", session.user.id)
      .single();

    if (userData) {
      user = initializeUser(userData);
    } else {
      user = initializeUser(currentUserId);
    }
  } else {
    user = initializeUser(currentUserId);
  }
  // const billUsers = await supabase.from('bills').select(
  // 	`
  // 		id,
  // 		title,
  // 		bill_users (
  // 			user_id,
  // 			bill_id
  // 		)
  // 	`
  // );
  // console.log(billUsers);

  return { session, supabase, user };
};
