<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import AnonymousSignIn from "$lib/components/auth/AnonymousSignIn.svelte";
  import Button from "$lib/components/base/buttons/Button.svelte";
  import Logo from "$lib/components/base/Logo.svelte";
  import { signInWithGoogle } from "$lib/utils/common/auth.svelte";
  import { DEFAULT_LOCALE, LOCALE_MASTER } from "$lib/utils/common/locale";

  // Sign-in surface (reached e.g. from an invite link when signed out): offer
  // Google (OAuth redirect) OR "continue as guest" (anonymous). On a session,
  // redirect to where the user was headed (authRedirect, e.g. /invite/<cheque>).
  const strings = LOCALE_MASTER[DEFAULT_LOCALE];
  let { data } = $props();
  let { authRedirect, session, supabase } = $derived(data);

  // True once the user chose "guest": mount AnonymousSignIn, which signs in
  // anonymously (with Turnstile) and shows its loader until the session lands.
  let guest = $state(false);

  $effect(() => {
    if (session) void handleRedirect();
  });

  async function handleRedirect() {
    await invalidate("supabase:auth"); // let other components see the new session
    void goto(authRedirect ?? "/cheques", { replaceState: true });
  }
</script>

{#if guest}
  <!-- Guest chosen → AnonymousSignIn signs in anonymously (with Turnstile) and
       shows its loader until the session lands and the effect above redirects. -->
  <AnonymousSignIn {supabase} />
{:else if !session}
  <header class="header">
    <Logo {strings} />
  </header>
  <main class="auth">
    <h1>{strings["signInToContinue"]}</h1>
    <!-- Return to /auth after OAuth so the session effect runs the invite redirect. -->
    <Button variant="secondary" onclick={() => signInWithGoogle(supabase, window.location.href)}>
      {strings["signInWithGoogle"]}
    </Button>
    <Button variant="secondary" onclick={() => (guest = true)}>
      {strings["continueAsGuest"]}
    </Button>
  </main>
{/if}

<style>
  /* Same header shell as the rest of the app: logo top-left, 64px bar, divider. */
  .header {
    background-color: var(--color-background);
    display: flex;
    gap: var(--space-2);
    min-block-size: 64px;
    padding: var(--space-2);
    position: sticky;
    top: 0;
    z-index: 1000;
  }
  .header::after {
    background: var(--color-border);
    block-size: var(--border-divider);
    content: "";
    inset-block-end: 0;
    inset-inline: 0;
    position: absolute;
  }

  .auth {
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--space-2) * 2);
    justify-content: center;
    padding: calc(var(--space-2) * 2);
    text-align: center;
  }

  h1 {
    font-size: 1.25rem;
    font-weight: 700;
  }
</style>
