<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { page } from "$app/state";
  import PwaPrompts from "$lib/components/pwa/PwaPrompts.svelte";
  import { createAppContext } from "$lib/state/app.svelte";
  import { TURNSTILE_CONTAINER_ID } from "$lib/utils/common/auth.svelte";
  import { untrack } from "svelte";

  let { children, data } = $props();
  let { session, supabase } = $derived(data);

  // Construct the app hub once and put it in context; it boots itself
  // (open IDB → clock/engine → identity → hydrate) and flips `initialized`.
  // The supabase client is stable for the session, so capture it once.
  const app = createAppContext(untrack(() => supabase));

  // Auth gate: only an account (anonymous guest or Google) may view cheques. A
  // signed-out visitor on a cheque route is sent to /auth, remembering where they
  // were headed. /auth, /invite (runs its own join flow), and /new (signs in
  // anonymously on demand) are exempt. The app root "/" reroutes to the list on
  // app.cheqii.com, so it's guarded too. Gated on `app.initialized` + the resolved
  // `app.user.data` (set during boot before initialized flips) rather than the
  // server-loaded `session`, which lags behind an in-flight anonymous sign-in.
  $effect(() => {
    if (!app.initialized || app.user.data) return;
    const path = page.url.pathname;
    if (path !== "/" && path !== "/cheques" && !path.startsWith("/cheques/")) return;
    document.cookie = `authRedirect=${path}; path=/; max-age=300`;
    void goto("/auth", { replaceState: true });
  });

  // Re-resolve identity on sign-in/out (the engine pump reacts to the new user);
  // tear down liveness listeners/subscription when the context goes away.
  $effect(() => {
    const unwatch = app.watchAuth();
    return () => {
      unwatch();
      app.dispose();
    };
  });

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
  <PwaPrompts />
{/if}
{#if !session}
  <div id={TURNSTILE_CONTAINER_ID}></div>
{/if}
