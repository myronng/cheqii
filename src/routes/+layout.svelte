<script lang="ts">
  import { invalidate } from "$app/navigation";
  import { TURNSTILE_CONTAINER_ID } from "$lib/utils/common/auth.svelte";
  import { setAppContext } from "$lib/utils/common/context.svelte";
  import "../app.css";

  let { children, data } = $props();
  let { session, supabase } = $derived(data);

  const app = setAppContext();

  $effect(() => {
    async function signOutInvalidUsers() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (session && !user) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error(error);
        }
      }
    }
    signOutInvalidUsers();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (newSession?.expires_at !== session?.expires_at) {
        invalidate("supabase:auth");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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
