<script lang="ts">
  import type { LocalizedStrings } from "$lib/utils/common/locale";
  import type { BillData } from "$lib/utils/models/bill.svelte";

  import Button from "$lib/components/base/buttons/Button.svelte";
  import Logo from "$lib/components/base/Logo.svelte";
  import EntryName from "$lib/components/entry/EntryName.svelte";
  import EntryShare from "$lib/components/entry/EntryShare.svelte";
  import Settings from "$lib/components/icons/Settings.svelte";

  let {
    billData = $bindable(),
    strings,
    url,
  }: {
    billData: BillData;
    strings: LocalizedStrings;
    url: string;
  } = $props();
</script>

{#snippet icon()}
  <Settings variant="button" />
{/snippet}

<header>
  <section>
    <Logo hasTitle={false} {strings} />
    <EntryName bind:billData {strings} />
  </section>
  <section>
    <EntryShare {strings} title={billData.name} {url} />
    <Button
      borderless
      {icon}
      onclick={() => {
        (
          document.getElementById("settingsDialog") as HTMLDialogElement
        ).showModal();
      }}
      title={strings["settings"]}
    />
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
