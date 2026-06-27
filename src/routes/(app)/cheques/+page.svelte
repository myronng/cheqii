<script lang="ts">
  import MainCallToAction from "$lib/components/main/MainCallToAction.svelte";
  import MainHeader from "$lib/components/main/MainHeader.svelte";
  import MainListing from "$lib/components/main/MainListing.svelte";
  import { getAppContext } from "$lib/state/app.svelte";
  import { flattenServerCheque } from "$lib/state/model";

  let { data } = $props();
  const app = getAppContext();

  // Cold-start hydration: ingest any server-listed cheques this device doesn't have
  // yet (local IDB is the source of truth once present, so we never re-add deletes).
  $effect(() => {
    if (!app.user.data) return;
    for (const raw of data.chequeList ?? []) {
      if (!app.cheques.byId(raw.id)) app.cheques.ingest(flattenServerCheque(raw));
    }
  });

  // Single source of truth, most-recently-updated first.
  const chequeList = $derived(
    [...app.cheques.list()].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)),
  );
</script>

<MainHeader session={data.session} strings={data.strings} supabase={data.supabase} />
<main>
  <MainCallToAction strings={data.strings} />
  <MainListing {chequeList} strings={data.strings} />
</main>

<style>
  main {
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--length-spacing) * 2);
    padding: calc(var(--length-spacing) * 2);
  }
</style>
