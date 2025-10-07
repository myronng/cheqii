<script lang="ts">
  import MainHeroImage from "$lib/components/main/mainHeroImage.svelte";
  import MainNewBillButton from "$lib/components/main/mainNewBillButton.svelte";
  import {
    type LocalizedStrings,
    interpolateString,
  } from "$lib/utils/common/locale";
  import type { AppUser } from "$lib/utils/common/user.svelte";

  let {
    strings,
    userId,
  }: { strings: LocalizedStrings; userId: AppUser["id"] } = $props();
</script>

<section>
  <article>
    <h1>
      {@html interpolateString(strings["a{collaborative}BillSplitter"], {
        collaborative: `<span style="color: var(--color-primary)">${strings["collaborative"]}</span>`,
      })}
    </h1>
    <p>
      {strings["intelligentlySplitYourGroupPurchasesUsingFewerTransactions"]}
    </p>
    <MainNewBillButton {strings} {userId} />
  </article>
  <MainHeroImage />
</section>

<style>
  article {
    align-items: flex-start;
    background-color: var(--color-background-surface);
    backdrop-filter: blur(var(--length-surface-blur));
    border: var(--length-divider) solid var(--color-divider);
    border-radius: var(--length-radius);
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    font-size: 1rem;
    gap: calc(var(--length-spacing) * 2);
    padding: calc(var(--length-spacing) * 2);
  }

  h1 {
    display: inline-block;
    font-family: "Comfortaa";
    font-size: 1.5rem;
  }

  section {
    align-items: center;
    display: flex;
    gap: calc(var(--length-spacing) * 4);
    inline-size: 100%;
    max-inline-size: 900px;
  }
</style>
