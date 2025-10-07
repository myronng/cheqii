<script lang="ts">
  import type { LocalizedStrings } from "$lib/utils/common/locale";
  import type { AppUser } from "$lib/utils/common/user.svelte";

  import Button from "$lib/components/base/buttons/button.svelte";
  import Add from "$lib/components/icons/add.svelte";
  import { createBillClient } from "$lib/utils/common/bill.svelte";

  let {
    strings,
    userId,
  }: {
    strings: LocalizedStrings;
    userId: AppUser["id"];
  } = $props();
</script>

{#snippet addIcon()}
  <Add variant="adaptive" />
{/snippet}

<Button
  onclick={async () => {
    await createBillClient(strings, userId);
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
