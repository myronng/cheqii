<script lang="ts">
  import AccountButton from "$lib/components/auth/AccountButton.svelte";
  import Logo from "$lib/components/base/Logo.svelte";
  import MainNewBillButton from "$lib/components/main/MainNewBillButton.svelte";
  import type { LocalizedStrings } from "$lib/utils/common/locale";
  import type { SupabaseClient } from "@supabase/supabase-js";

  let {
    strings,
    supabase,
  }: {
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
    <MainNewBillButton {strings} />
    <AccountButton {strings} {supabase} />
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
