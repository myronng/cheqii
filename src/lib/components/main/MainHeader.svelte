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
  /* Always 64px: 48px content (the logo / 48px action buttons) + 8px padding each
     side. Children stretch (no align-items:center) so the "Sign in" pill fills the
     48px height too — same as the entry header — instead of shrinking. */
  header {
    background-color: var(--color-background);
    display: flex;
    gap: var(--space-2);
    justify-content: space-between;
    min-block-size: 64px;
    padding: var(--space-2);
    position: sticky;
    top: 0;
    z-index: 1000;
  }
  /* Divider as an overlay so it doesn't add to the 64px bar height. */
  header::after {
    background: var(--color-border);
    block-size: var(--border-divider);
    content: "";
    inset-block-end: 0;
    inset-inline: 0;
    position: absolute;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }
</style>
