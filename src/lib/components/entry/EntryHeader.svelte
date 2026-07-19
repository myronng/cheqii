<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { ChequeData } from "$lib/state/model";
  import type { LocalizedStrings } from "$lib/utils/common/locale";
  import type { Session, SupabaseClient } from "@supabase/supabase-js";

  import AccountButton from "$lib/components/auth/AccountButton.svelte";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import Logo from "$lib/components/base/Logo.svelte";
  import EntryName from "$lib/components/entry/EntryName.svelte";
  import EntryShare from "$lib/components/entry/EntryShare.svelte";
  import Settings from "$lib/components/icons/Settings.svelte";

  let {
    chequeData,
    session,
    strings,
    supabase,
    url,
  }: {
    chequeData: ChequeData;
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
    <EntryName {chequeData} {strings} />
  </section>
  <section>
    <EntryShare {strings} title={chequeData.name} {url} />
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
    background-color: var(--color-background);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: space-between;
    min-block-size: 64px;
    padding: var(--space-2);
    position: sticky;
    top: 0;
    z-index: 1000;

    section {
      /* Center children so the borderless cheque-name input sits at its natural
         height instead of stretching to the 64px bar. */
      align-items: center;
      display: flex;
      gap: var(--space-2);
    }

    /* Keep the actions (share/settings/account) hard against the inline-end even
       when a long cheque name pushes them onto their own wrapped row — where
       justify-content: space-between would otherwise left-align the lone item. */
    section:last-child {
      margin-inline-start: auto;
    }
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
</style>
