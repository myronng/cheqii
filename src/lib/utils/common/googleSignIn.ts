import { goto } from "$app/navigation";
import { PUBLIC_GOOGLE_CLIENT_ID } from "$env/static/public";
import type { SupabaseClient } from "@supabase/supabase-js";

const generateNonce = async () => {
  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  );
  const encoder = new TextEncoder();
  const encodedNonce = encoder.encode(nonce);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encodedNonce);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedNonce = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { hashedNonce, nonce };
};

export const initializeGoogleOneTap =
  (supabase: SupabaseClient) => async () => {
    // generate nonce to use for google id token sign-in
    const { hashedNonce, nonce } = await generateNonce();

    // check if there's already an existing session before initializing the one-tap UI
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error getting session", error);
    }
    if (!data.session) {
      window.google.accounts.id.initialize({
        callback: async (response: { credential: string }) => {
          try {
            // send id token returned in response.credential to supabase
            const { error } = await supabase.auth.signInWithIdToken({
              nonce,
              provider: "google",
              token: response.credential,
            });

            if (error) {
              throw error;
            }
            // redirect to protected page
            goto("/");
          } catch (error) {
            console.error("Error logging in with Google One Tap", error);
          }
        },
        client_id: PUBLIC_GOOGLE_CLIENT_ID,
        nonce: hashedNonce,
        // with chrome's removal of third-party cookiesm, we need to use FedCM instead (https://developers.google.com/identity/gsi/web/guides/fedcm-migration)
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.prompt(); // Display the One Tap UI
    }
  };
