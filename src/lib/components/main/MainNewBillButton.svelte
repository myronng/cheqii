<script lang="ts">
  import { page } from "$app/state";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import Add from "$lib/components/icons/Add.svelte";
  import { getAppContext } from "$lib/utils/common/context.svelte";
  import type { LocalizedStrings } from "$lib/utils/common/locale";
  import { createBill } from "$lib/utils/models/bill.svelte";

  let {
    strings,
  }: {
    strings: LocalizedStrings;
  } = $props();

  const { bills, sync, user } = getAppContext();
  const supabase = $derived(page.data.supabase);
</script>

{#snippet addIcon()}
  <Add variant="adaptive" />
{/snippet}

<Button
  onclick={async () => {
    await createBill(supabase, strings, user, sync, bills);
  }}
  icon={addIcon}
  title={strings["newBill"]}
>
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
