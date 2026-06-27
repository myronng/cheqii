<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { BillData } from "$lib/state/model";
  import type { LocalizedStrings } from "$lib/utils/common/locale";
  import type { Session, SupabaseClient } from "@supabase/supabase-js";

  import AccountButton from "$lib/components/auth/AccountButton.svelte";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import Logo from "$lib/components/base/Logo.svelte";
  import EntryName from "$lib/components/entry/EntryName.svelte";
  import EntryShare from "$lib/components/entry/EntryShare.svelte";
  import SyncStatus from "$lib/components/entry/SyncStatus.svelte";
  import Settings from "$lib/components/icons/Settings.svelte";

  let {
    billData,
    session,
    strings,
    supabase,
    url,
  }: {
    billData: BillData;
    session: null | Session;
    strings: LocalizedStrings;
    supabase: SupabaseClient;
    url: string;
  } = $props();
</script>

{#snippet icon()}
  <Settings variant="button" />
{/snippet}

<header>
  <section>
    <Logo hasTitle={false} {strings} />
    <EntryName {billData} {strings} />
  </section>
  <section>
    <SyncStatus {strings} />
    <EntryShare {strings} title={billData.name} {url} />
    <Button
      borderless
      {icon}
      onclick={() => goto(`${page.url.pathname}${page.url.search}#settings`, { noScroll: true })}
      title={strings["settings"]}
    />
    <AccountButton {session} {strings} {supabase} />
  </section>
</header>

<style>
  header {
    background-color: var(--color-background-primary);
    border-bottom: var(--length-divider) solid var(--color-divider);
    display: flex;
    flex-wrap: wrap;
    gap: var(--length-spacing);
    justify-content: space-between;
    padding: var(--length-spacing);
    position: sticky;
    top: 0;
    z-index: 1000;

    section {
      display: flex;
      gap: var(--length-spacing);
    }
  }
</style>
