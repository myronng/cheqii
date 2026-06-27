<script lang="ts">
  import AccountButton from "$lib/components/auth/AccountButton.svelte";
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
    <!-- One affordance for all states: signed-out → signInWithOAuth, guest →
         linkIdentity (keeps their cheques), permanent → avatar. -->
    <AccountButton {session} {strings} {supabase} />
  </div>
</header>

<style>
  header {
    align-items: center;
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
    align-items: center;
    display: flex;
    gap: var(--length-spacing);
  }
</style>
