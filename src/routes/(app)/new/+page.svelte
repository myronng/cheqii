<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Loader from "$lib/components/base/Loader.svelte";
  import Logo from "$lib/components/base/Logo.svelte";
  import { createNewCheque } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";

  let { data } = $props();
  const app = getAppContext();
  const supabase = $derived(page.data.supabase);

  // The (app) layout only renders children once the app has booted, so by the
  // time this mounts `app.initialized` is true. Kick off exactly one cheque
  // creation (sign in anonymously if needed), which redirects to /cheques/[id].
  // A guest at the cheque cap is sent to the shared /limit wall instead (which
  // resumes here after sign-in, so the interrupted creation completes).
  let started = false;
  $effect(() => {
    if (started) return;
    started = true;
    createNewCheque(app, supabase, data.strings).then((result) => {
      if (result === "guest_cap") void goto("/limit", { replaceState: true });
    });
  });
</script>

<main>
  <Logo strings={data.strings} />
  <Loader />
  <p>{data.strings["startingYourCheque"]}</p>
</main>

<style>
  main {
    align-items: center;
    color: var(--color-text-muted);
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--space-4);
    justify-content: center;
    min-block-size: 100dvh;
    padding: var(--space-4);
    text-align: center;
  }
</style>
