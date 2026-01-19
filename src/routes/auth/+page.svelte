<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import AnonymousSignIn from "$lib/components/auth/AnonymousSignIn.svelte";

  let { data } = $props();
  let { authRedirect, session, supabase } = $derived(data);

  $effect(() => {
    if (session) {
      handleRedirect();
    }
  });

  async function handleRedirect() {
    // Force refresh the auth state so other components find out
    await invalidate("supabase:auth");
    goto(authRedirect ?? "/", { replaceState: true });
  }
</script>

{#if !session}
  <AnonymousSignIn {supabase} />
{/if}
