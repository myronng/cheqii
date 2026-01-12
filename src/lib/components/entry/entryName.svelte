<script lang="ts">
  import type { BillData, OnBillChange } from "$lib/utils/models/bill.svelte";

  import Input from "$lib/components/base/input.svelte";
  import { DATE_FORMATTER } from "$lib/utils/common/formatter";
  import {
    type LocalizedStrings,
    interpolateString,
  } from "$lib/utils/common/locale";
  import type { Database } from "$lib/utils/models/database";
  import type { SupabaseClient } from "@supabase/supabase-js";

  let {
    billData = $bindable(),
    onBillChange,
    strings,
    supabase,
  }: {
    billData: BillData;
    onBillChange: OnBillChange;
    strings: LocalizedStrings;
    supabase: SupabaseClient<Database>;
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
    await Promise.all([
      supabase
        .from("bills")
        .update({ name: billData.name })
        .eq("id", billData.id),
      onBillChange(billData),
    ]);
  }}
  placeholder={strings["billName"]}
  required
  title={strings["billName"]}
  value={billData.name}
/>
