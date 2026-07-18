<script lang="ts">
  import Input from "$lib/components/base/Input.svelte";
  import { updateCheque } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";
  import type { ChequeData } from "$lib/state/model";
  import { DATE_FORMATTER } from "$lib/utils/common/formatter";
  import {
    type LocalizedStrings,
    interpolateString,
  } from "$lib/utils/common/locale";

  let {
    chequeData,
    strings,
  }: {
    chequeData: ChequeData;
    strings: LocalizedStrings;
  } = $props();

  const app = getAppContext();
</script>

<svelte:head>
  <title>{chequeData.name}</title>
</svelte:head>

<Input
  autocomplete="off"
  borderless
  name="cheque-name"
  onchange={async (e) => {
    let newName = e.currentTarget.value;
    if (!newName) {
      newName = interpolateString(strings["cheque{date}"], {
        date: DATE_FORMATTER.format(new Date()),
      });
    }
    if (app.user.data) {
      await updateCheque(app, chequeData.id, { name: newName });
    }
  }}
  placeholder={strings["chequeName"]}
  required
  title={strings["chequeName"]}
  value={chequeData.name}
/>
