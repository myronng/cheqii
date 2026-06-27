<script lang="ts">
  import AccountButton from "$lib/components/auth/AccountButton.svelte";
  import GoogleSignIn from "$lib/components/auth/GoogleSignIn.svelte";
  import Logo from "$lib/components/base/Logo.svelte";
  import type { LocalizedStrings } from "$lib/utils/common/locale";
  import type { Session, SupabaseClient } from "@supabase/supabase-js";

  let {
    session,
    strings,
    supabase,
  }: {
    session: null | Session;
    strings: LocalizedStrings;
    supabase: SupabaseClient;
  } = $props();
</script>

<svelte:head>
  <title>{strings["appName"]}</title>
</svelte:head>

<header>
  <Logo {strings} />
  <div class="actions">
    {#if session}
      <!-- Signed in (guest or permanent): account menu / link guest → Google. -->
      <AccountButton {session} {strings} {supabase} />
    {:else}
      <!-- Signed out: Google One Tap + the standard "Sign in with Google" button. -->
      <GoogleSignIn {supabase} />
    {/if}
  </div>
</header>

<style>
  header {
    background-color: var(--color-background-primary);
    border-bottom: var(--length-divider) solid var(--color-divider);
    display: flex;
    gap: var(--length-spacing);
    justify-content: space-between;
    padding: var(--length-spacing);
    position: sticky;
    top: 0;
    z-index: 1000;
  }

  .actions {
    display: flex;
    gap: var(--length-spacing);
  }
</style>
