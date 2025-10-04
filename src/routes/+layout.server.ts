import type { CheqiiUser } from "$lib/utils/common/user.svelte";

import { signData, TEXT_ENCODER } from "$lib/utils/common/hash";

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({
  cookies,
  locals: { supabase },
}) => {
  const cookieUserId = cookies.get("userId");
  const sessionUserId = (await supabase.auth.getUser()).data.user?.id;
  if (sessionUserId && cookieUserId && sessionUserId !== cookieUserId) {
    // TODO: Merge user data
  }
  if (!cookieUserId) {
    const userId = sessionUserId ?? cookieUserId ?? crypto.randomUUID();
    cookies.set("userId", userId, {
      path: "/",
    });
    const user: CheqiiUser = {
      cheques: [],
      id: userId,
      invite: { required: true },
      serverSignature: await signData(TEXT_ENCODER.encode(userId)),
      updatedAtClient: Date.now(),
      updatedAtServer: Date.now(),
    };
    console.log(user);
  }

  // TODO: Read PEM keys
  // console.log(
  //
  // );
  // console.log(getKeyPayload(PUBLIC_SERVER_KEY));

  return {
    cookies: cookies.getAll(),
  };
};

export const ssr = false;
