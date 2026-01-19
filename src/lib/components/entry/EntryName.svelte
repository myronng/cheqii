<script lang="ts">
  import Input from "$lib/components/base/Input.svelte";
  import { getAppContext } from "$lib/utils/common/context.svelte";
  import { DATE_FORMATTER } from "$lib/utils/common/formatter";
  import {
    type LocalizedStrings,
    interpolateString,
  } from "$lib/utils/common/locale";
  import { type BillData, updateBill } from "$lib/utils/models/bill.svelte";

  let {
    billData = $bindable(),
    strings,
  }: {
    billData: BillData;
    strings: LocalizedStrings;
  } = $props();

  const app = getAppContext();
</script>

<svelte:head>
  <title>{billData.name}</title>
</svelte:head>

<Input
  onchange={async (e) => {
    let newName = e.currentTarget.value;
    if (!newName) {
      newName = interpolateString(strings["bill{date}"], {
        date: DATE_FORMATTER.format(new Date()),
      });
    }
    if (app.user.data) {
      await updateBill(app, billData, { name: newName });
    }
  }}
  placeholder={strings["billName"]}
  required
  title={strings["billName"]}
  value={billData.name}
/>
