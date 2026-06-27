<script lang="ts">
  import { page } from "$app/state";
  import Logo from "$lib/components/base/Logo.svelte";
  import { createNewCheque } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";

  let { data } = $props();
  const app = getAppContext();
  const supabase = $derived(page.data.supabase);

  // The (app) layout only renders children once the app has booted, so by the
  // time this mounts `app.initialized` is true. Kick off exactly one cheque
  // creation (sign in anonymously if needed), which redirects to /cheques/[id].
  let started = false;
  $effect(() => {
    if (started) return;
    started = true;
    void createNewCheque(app, supabase, data.strings);
  });
</script>

<main>
  <Logo strings={data.strings} />
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
  }
</style>
