<script lang="ts">
  import { goto } from "$app/navigation";
  import { PUBLIC_GOOGLE_CLIENT_ID } from "$env/static/public";
  import type { SupabaseClient } from "@supabase/supabase-js";
  import type { PromptMomentNotification } from "google-one-tap";
  import { onDestroy, onMount } from "svelte";

  let { supabase }: { supabase: SupabaseClient } = $props();

  const generateNonce = async () => {
    const nonce = btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
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

  async function handleLoad() {
    if (!("google" in window)) return;

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
            const { error: signInError } =
              await supabase.auth.signInWithIdToken({
                nonce,
                provider: "google",
                token: response.credential,
              });

            if (signInError) {
              throw signInError;
            }

            // redirect to protected page
            goto("/");
          } catch (e) {
            console.error("Error logging in with Google One Tap", e);
          }
        },
        client_id: PUBLIC_GOOGLE_CLIENT_ID,
        nonce: hashedNonce,
        // with chrome's removal of third-party cookies, we need to use FedCM instead (https://developers.google.com/identity/gsi/web/guides/fedcm-migration)
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.prompt(
        (notification: PromptMomentNotification) => {
          if (notification.isNotDisplayed()) {
            console.error(
              "One Tap not displayed:",
              notification.getNotDisplayedReason()
            );
          } else if (notification.isSkippedMoment()) {
            console.warn("One Tap skipped:", notification.getSkippedReason());
          } else if (notification.isDismissedMoment()) {
            console.warn(
              "One Tap dismissed:",
              notification.getDismissedReason()
            );
          }
        }
      );
    }
  }

  onMount(() => {
    if ("google" in window) {
      handleLoad();
    }
  });

  onDestroy(() => {
    if ("google" in window) {
      window.google.accounts.id.cancel();
    }
  });
</script>

<svelte:head>
  <script
    src="https://accounts.google.com/gsi/client"
    async
    id="googleSignInScript"
    onload={handleLoad}
  ></script>
</svelte:head>
