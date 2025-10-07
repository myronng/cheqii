<script lang="ts">
  import type { BillData, OnBillChange } from "$lib/utils/common/bill.svelte";

  import Input from "$lib/components/base/input.svelte";
  import { DATE_FORMATTER } from "$lib/utils/common/formatter";
  import {
    interpolateString,
    type LocalizedStrings,
  } from "$lib/utils/common/locale";

  let {
    billData = $bindable(),
    onBillChange,
    strings,
  }: {
    billData: BillData;
    onBillChange: OnBillChange;
    strings: LocalizedStrings;
  } = $props();
</script>

<svelte:head>
  <title>{billData.name}</title>
</svelte:head>

<Input
  onchange={async (e) => {
    if (!e.currentTarget.value) {
      billData.name = interpolateString(strings["bill{date}"], {
        date: DATE_FORMATTER.format(new Date()),
      });
    } else {
      billData.name = e.currentTarget.value;
    }
    await onBillChange(billData);
  }}
  placeholder={strings["billName"]}
  required
  title={strings["billName"]}
  value={billData.name}
/>
