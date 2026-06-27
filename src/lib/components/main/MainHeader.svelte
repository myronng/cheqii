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
  <!-- Full-bleed bar (bg + border), but content is constrained to the same
       78rem-centered box as the listing so the logo / sign-in line up with
       "Your cheques" / "Start a cheque" below. -->
  <div class="inner">
    <Logo {strings} />
    <div class="actions">
      <!-- One affordance for all states: signed-out → signInWithOAuth, guest →
           linkIdentity (keeps their cheques), permanent → avatar. -->
      <AccountButton {session} {strings} {supabase} />
    </div>
  </div>
</header>

<style>
  header {
    background-color: var(--color-background-primary);
    border-bottom: var(--length-divider) solid var(--color-divider);
    padding-block: var(--length-spacing);
    position: sticky;
    top: 0;
    z-index: 1000;
  }

  .inner {
    align-items: center;
    display: flex;
    gap: var(--length-spacing);
    inline-size: 100%;
    justify-content: space-between;
    margin-inline: auto;
    max-inline-size: 78rem;
    padding-inline: var(--length-spacing);
  }

  .actions {
    align-items: center;
    display: flex;
    gap: var(--length-spacing);
  }
</style>
