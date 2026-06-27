<script lang="ts">
  import { page } from "$app/state";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import Add from "$lib/components/icons/Add.svelte";
  import { getAppContext } from "$lib/state/app.svelte";
  import { createNewBill } from "$lib/state/actions";
  import type { LocalizedStrings } from "$lib/utils/common/locale";

  let {
    strings,
  }: {
    strings: LocalizedStrings;
  } = $props();

  const app = getAppContext();
  const supabase = $derived(page.data.supabase);

  async function onNewBill() {
    await createNewBill(app, supabase, strings);
  }
</script>

{#snippet addIcon()}
  <Add variant="adaptive" />
{/snippet}

<Button onclick={onNewBill} icon={addIcon} title={strings["newBill"]}>
  <span class="buttonMobileText">
    {strings["newBill"]}
  </span>
</Button>

<style>
  @media screen and (max-width: 768px) {
    .buttonMobileText {
      display: none;
    }
  }
</style>
