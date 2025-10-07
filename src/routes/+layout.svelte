<script lang="ts">
  import "../app.css";

  import { invalidate } from "$app/navigation";
  import { initializeGoogleOneTap } from "$lib/utils/common/googleSignIn";
  import { getUser } from "$lib/utils/common/user.svelte";

  let { children, data } = $props();
  let { session, supabase } = $derived(data);

  $effect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (newSession?.expires_at !== session?.expires_at) {
        invalidate("supabase:auth");
      }
    });

    const googleSignInScript = document.getElementById("googleSignInScript");

    if (googleSignInScript && !("google" in window)) {
      googleSignInScript.addEventListener(
        "load",
        initializeGoogleOneTap(data.supabase),
      );
    }

    if (data.user) {
      getUser(data.user.id);
    }

    return () => {
      if (googleSignInScript) {
        googleSignInScript.removeEventListener(
          "load",
          initializeGoogleOneTap(data.supabase),
        );
      }

      subscription.unsubscribe();
    };
  });
</script>

<svelte:head>
  <script
    src="https://accounts.google.com/gsi/client"
    async
    id="googleSignInScript"
  ></script>
</svelte:head>

{@render children()}
