<script lang="ts">
  import { page } from "$app/state";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import Add from "$lib/components/icons/Add.svelte";
  import { getAppContext } from "$lib/state/app.svelte";
  import { createBill, starterBill } from "$lib/state/actions";
  import { signInAnonymously } from "$lib/utils/common/auth.svelte";
  import { DATE_FORMATTER } from "$lib/utils/common/formatter";
  import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";

  let {
    strings,
  }: {
    strings: LocalizedStrings;
  } = $props();

  const app = getAppContext();
  const supabase = $derived(page.data.supabase);

  async function onNewBill() {
    // First action that needs an identity: sign in anonymously, then resolve.
    if (!app.user.data) {
      await signInAnonymously(supabase);
      await app.resolveIdentity();
    }
    const user = app.user.data;
    if (!user) return;

    const bill = starterBill(user.id, {
      name: interpolateString(strings["bill{date}"], {
        date: DATE_FORMATTER.format(new Date()),
      }),
      contributorName: (index) =>
        interpolateString(strings["contributor{index}"], { index: String(index) }),
      itemName: (index) => interpolateString(strings["item{index}"], { index: String(index) }),
    });
    await createBill(app, bill);
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
