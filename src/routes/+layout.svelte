<script lang="ts">
  import { invalidate } from "$app/navigation";
  import { createAppContext } from "$lib/state/app.svelte";
  import { TURNSTILE_CONTAINER_ID } from "$lib/utils/common/auth.svelte";
  import { untrack } from "svelte";
  import "../app.css";

  let { children, data } = $props();
  let { session, supabase } = $derived(data);

  // Construct the app hub once and put it in context; it boots itself
  // (open IDB → clock/engine → identity → hydrate) and flips `initialized`.
  // The supabase client is stable for the session, so capture it once.
  const app = createAppContext(untrack(() => supabase));

  // Re-resolve identity on sign-in/out (the engine pump reacts to the new user).
  $effect(() => app.watchAuth());

  $effect(() => {
    // Sign out a stale session whose JWT no longer validates.
    async function signOutInvalidUsers() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (session && !user) {
        const { error } = await supabase.auth.signOut();
        if (error) console.error(error);
      }
    }
    void signOutInvalidUsers();

    // Re-run the layout load when the session is refreshed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (newSession?.expires_at !== session?.expires_at) {
        invalidate("supabase:auth");
      }
    });

    return () => subscription.unsubscribe();
  });
</script>

<svelte:head>
  {#if !session}
    <script
      src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      async
      defer
    ></script>
  {/if}
</svelte:head>

{#if app.initialized}
  {@render children()}
{/if}
{#if !session}
  <div id={TURNSTILE_CONTAINER_ID}></div>
{/if}
