<script lang="ts">
  import { invalidate } from "$app/navigation";
  import { PUBLIC_GOOGLE_CLIENT_ID } from "$env/static/public";
  import type { SupabaseClient } from "@supabase/supabase-js";
  import { onDestroy, onMount } from "svelte";

  // Google sign-in surface for SIGNED-OUT visitors: Google One Tap (auto prompt)
  // + the standard rendered "Sign in with Google" button. Both use the id-token
  // flow (signInWithIdToken). We only run when there is NO session, so this never
  // mints a second account over an anonymous guest (that orphan case is handled by
  // AccountButton's linkIdentity, which preserves the guest's user_id + data).
  let { supabase }: { supabase: SupabaseClient } = $props();

  let buttonEl = $state<HTMLDivElement>();
  let show = $state(false); // true only once we confirm there's no session

  const generateNonce = async () => {
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
    const hashedNonce = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { hashedNonce, nonce };
  };

  async function handleLoad() {
    if (!("google" in window)) return;
    // Skip entirely if already signed in (guest or permanent) — see note above.
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    show = true;

    const { hashedNonce, nonce } = await generateNonce();
    const callback = async (response: { credential: string }) => {
      try {
        const { error } = await supabase.auth.signInWithIdToken({
          nonce,
          provider: "google",
          token: response.credential,
        });
        if (error) throw error;
        // Refresh the layout session; the surface decides where to go next
        // (home re-renders signed-in; /auth redirects via its session effect).
        await invalidate("supabase:auth");
      } catch (e) {
        console.error("Google sign-in failed", e);
      }
    };

    window.google.accounts.id.initialize({
      callback,
      client_id: PUBLIC_GOOGLE_CLIENT_ID,
      nonce: hashedNonce,
      // FedCM (third-party cookies are going away): https://developers.google.com/identity/gsi/web/guides/fedcm-migration
      use_fedcm_for_prompt: true,
    });

    // Standard rendered button (the explicit "Sign in with Google" flow).
    if (buttonEl) {
      window.google.accounts.id.renderButton(buttonEl, {
        theme: "outline",
        type: "standard",
        size: "large",
        text: "signin_with",
        shape: "pill",
      });
    }

    // One Tap prompt (auto). No status callback: with FedCM the moment-status
    // methods are deprecated, and the rendered button is the reliable fallback.
    window.google.accounts.id.prompt();
  }

  onMount(() => {
    if ("google" in window) void handleLoad();
  });
  onDestroy(() => {
    if ("google" in window) window.google.accounts.id.cancel();
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

<!-- Container the GIS button renders into; hidden until we confirm signed-out. -->
<div class="googleButton" class:show bind:this={buttonEl}></div>

<style>
  .googleButton {
    display: none;
  }
  .googleButton.show {
    display: inline-flex;
  }
</style>
