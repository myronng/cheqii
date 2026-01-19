import { invalidate } from "$app/navigation";
import { PUBLIC_TURNSTILE_SITE_KEY } from "$env/static/public";
import {
  type IUserState,
  type UserData,
  initializeUser,
} from "$lib/utils/models/user.svelte";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TURNSTILE_CONTAINER_ID = "turnstile-container";

export const signInAnonymously = (
  supabase: SupabaseClient,
  user: IUserState,
) => {
  try {
    return new Promise<UserData>((resolve, reject) => {
      window.turnstile.render(`#${TURNSTILE_CONTAINER_ID}`, {
        sitekey: PUBLIC_TURNSTILE_SITE_KEY,
        callback: async (token: string) => {
          try {
            const { data, error } = await supabase.auth.signInAnonymously({
              options: {
                captchaToken: token,
              },
            });

            if (error) {
              window.turnstile.reset(`#${TURNSTILE_CONTAINER_ID}`);
              reject(error);
            } else if (data.user) {
              const newUser = initializeUser(data.user.id);
              const { bills, ...dbUser } = newUser;
              const { error: insertError } = await supabase
                .from("users")
                .insert(dbUser);

              if (insertError) {
                window.turnstile.reset(`#${TURNSTILE_CONTAINER_ID}`);
                reject(insertError);
              } else {
                user.update(newUser);
                await invalidate("supabase:auth");
                resolve(newUser);
              }
            }
          } catch (err) {
            window.turnstile.reset(`#${TURNSTILE_CONTAINER_ID}`);
            reject(err);
          }
        },
        "error-callback": (err) => {
          reject(new Error("Turnstile error: " + err));
        },
        theme:
          (document.documentElement.dataset.theme as Turnstile.Theme) || "auto",
        size: "invisible" as any,
      });
    });
  } catch (err) {
    // User is likely (not guaranteed) to be offline
    console.error(err);
    const newUser = initializeUser(crypto.randomUUID());
    user.update(newUser);
    return Promise.resolve(newUser);
  }
};
