<script lang="ts">
  import MainBill from "$lib/components/main/MainBill.svelte";
  import MainEmptyList from "$lib/components/main/MainEmptyList.svelte";
  import { DATETIME_FORMATTER } from "$lib/utils/common/formatter";
  import { type LocalizedStrings } from "$lib/utils/common/locale";
  import type { BillData } from "$lib/utils/models/bill.svelte";

  let {
    billList,
    strings,
  }: {
    billList: BillData[];
    strings: LocalizedStrings;
  } = $props();
</script>

<section class={billList.length === 0 ? "noData" : undefined}>
  {#if billList.length === 0}
    <MainEmptyList />
    {strings["youHaveNoBills"]}
  {:else}
    <div class="headings">
      <span class="heading">{strings["billName"]}</span>
      <span class="heading">{strings["lastModified"]}</span>
    </div>
    {#each billList as bill, index}
      <MainBill alternate={index % 2 === 0} href={`/bills/${bill.id}`}>
        <span>
          {bill.name}
        </span>
        <span class="text">
          {DATETIME_FORMATTER.format(new Date(bill.updated_at))}
        </span>
      </MainBill>
    {/each}
  {/if}
</section>

<style>
  section {
    backdrop-filter: blur(var(--length-surface-blur));
    background: var(--color-background-surface);
    border: var(--length-divider) solid var(--color-divider);
    border-radius: var(--length-radius);
    inline-size: 100%;
    max-inline-size: 900px;
    overflow: hidden;

    &:not(.noData) {
      display: grid;
      grid-template-columns: 1fr max-content max-content;
    }

    &.noData {
      align-items: center;
      color: var(--color-font-disabled);
      display: flex;
      flex: 1;
      flex-direction: column;
      font-size: 2rem;
      gap: calc(var(--length-spacing) * 2);
      justify-content: center;
      padding: var(--length-spacing);
      padding-bottom: calc(var(--length-spacing) * 4);
      text-align: center;
    }
  }

  .text {
    color: var(--color-font-disabled);
  }

  .headings {
    display: grid;
    gap: calc(var(--length-spacing) * 2);
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    padding: calc(var(--length-spacing) * 2);
  }
</style>
