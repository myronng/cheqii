<script lang="ts">
  import Logo from "$lib/components/base/logo.svelte";
  import AccountButton from "$lib/components/common/accountButton.svelte";
  import MainNewBillButton from "$lib/components/main/mainNewBillButton.svelte";
  import type { LocalizedStrings } from "$lib/utils/common/locale";
  import type { AppUser } from "$lib/utils/models/user.svelte";
  import type { SupabaseClient } from "@supabase/supabase-js";

  let {
    strings,
    supabase,
    userId,
  }: {
    strings: LocalizedStrings;
    supabase: SupabaseClient;
    userId: AppUser["id"];
  } = $props();
</script>

<svelte:head>
  <title>{strings["appName"]}</title>
</svelte:head>

<header>
  <Logo {strings} />
  <div class="actions">
    <MainNewBillButton {strings} {userId} />
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
