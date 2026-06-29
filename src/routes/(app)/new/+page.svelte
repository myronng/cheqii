<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import Logo from "$lib/components/base/Logo.svelte";
  import { createNewCheque } from "$lib/state/actions";
  import { getAppContext } from "$lib/state/app.svelte";
  import { signInWithGoogle } from "$lib/utils/common/auth.svelte";

  let { data } = $props();
  const app = getAppContext();
  const supabase = $derived(page.data.supabase);

  // "guest_cap" → the guest hit the 6-cheque limit; show an upgrade prompt instead
  // of spinning. Otherwise createNewCheque redirects into the new cheque.
  let blocked = $state(false);

  // The (app) layout only renders children once the app has booted, so by the
  // time this mounts `app.initialized` is true. Kick off exactly one cheque
  // creation (sign in anonymously if needed), which redirects to /cheques/[id].
  let started = false;
  $effect(() => {
    if (started) return;
    started = true;
    createNewCheque(app, supabase, data.strings).then((result) => {
      if (result === "guest_cap") blocked = true;
    });
  });
</script>

<main>
  <Logo strings={data.strings} />
  {#if blocked}
    <h1 class="title">{data.strings["guestChequeLimitTitle"]}</h1>
    <p class="body">{data.strings["guestChequeLimitBody"]}</p>
    <div class="actions">
      <Button variant="primary" onclick={() => signInWithGoogle(supabase)}>
        {data.strings["continueWithGoogle"]}
      </Button>
      <Button borderless onclick={() => goto("/cheques")}>
        {data.strings["backToYourCheques"]}
      </Button>
    </div>
  {:else}
    <p>{data.strings["startingYourCheque"]}</p>
  {/if}
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
  .title {
    color: var(--color-text);
    font-size: var(--text-xl);
    font-weight: 700;
    margin: 0;
  }
  .body {
    margin: 0;
    max-inline-size: 26rem;
  }
  .actions {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
</style>
