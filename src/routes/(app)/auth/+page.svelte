<script lang="ts">
  import { onMount } from "svelte";
  import { goto, invalidate } from "$app/navigation";
  import AnonymousSignIn from "$lib/components/auth/AnonymousSignIn.svelte";
  import SiteHeader from "$lib/components/marketing/SiteHeader.svelte";
  import { signInWithGoogle } from "$lib/utils/common/auth.svelte";
  import { DEFAULT_LOCALE, LOCALE_MASTER, interpolateString } from "$lib/utils/common/locale";

  // Sign-in surface (reached when a signed-out visitor hits a cheque/invite link):
  // sell the value of signing in, with "Continue as guest" as a clear secondary
  // path. On a session, redirect to where they were headed (authRedirect).
  const strings = LOCALE_MASTER[DEFAULT_LOCALE];
  let { data } = $props();
  let { authRedirect, session, supabase } = $derived(data);

  // When arriving from an invite link, the /invite page stashes the cheque + token
  // in sessionStorage. Use the token to fetch a tiny preview (name + counts) so the
  // page can name the cheque you're joining — without exposing private data (the
  // RPC only returns it for a valid invite token).
  let chequeName = $state<string | null>(null);
  let peopleCount = $state(0);
  let itemCount = $state(0);

  onMount(async () => {
    try {
      const stash = JSON.parse(sessionStorage.getItem("pendingInvite") ?? "null");
      if (!stash?.chequeId || !stash?.token) return;
      const { data: rows } = await supabase.rpc("get_invite_preview", {
        p_cheque_id: stash.chequeId,
        p_invite_id: stash.token,
      });
      const row = rows?.[0];
      if (row) {
        chequeName = row.name;
        peopleCount = row.people_count;
        itemCount = row.item_count;
      }
    } catch {
      /* preview is best-effort — fall back to the generic lead */
    }
  });

  const lead = $derived(
    chequeName
      ? interpolateString(strings["signInToContinueTo{cheque}"], { cheque: chequeName })
      : authRedirect
        ? strings["youreInvitedToJoinACheque"]
        : strings["signInToContinue"],
  );
  const peopleLabel = $derived(
    interpolateString(peopleCount === 1 ? strings["{count}Person"] : strings["{count}People"], {
      count: String(peopleCount),
    }),
  );
  const itemsLabel = $derived(
    interpolateString(itemCount === 1 ? strings["{count}Item"] : strings["{count}Items"], {
      count: String(itemCount),
    }),
  );

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

  const benefits = [
    { title: strings["benefitSyncTitle"], desc: strings["benefitSyncDesc"], icon: "sync" },
    { title: strings["benefitBackupTitle"], desc: strings["benefitBackupDesc"], icon: "backup" },
    {
      title: strings["benefitIdentityTitle"],
      desc: strings["benefitIdentityDesc"],
      icon: "identity",
    },
  ] as const;
</script>

{#if guest}
  <!-- Guest chosen → AnonymousSignIn signs in anonymously (with Turnstile) and
       shows its loader until the session lands and the effect above redirects. -->
  <AnonymousSignIn {supabase} />
{:else if !session}
  <SiteHeader {strings} />
  <main class="auth">
    <div class="col">
      <div class="invite">
        <h1 class="lead">{lead}</h1>
        {#if chequeName}
          <p class="meta">{peopleLabel} · {itemsLabel}</p>
        {/if}
      </div>

      <div class="card">
        <!-- Return to /auth after OAuth so the session effect runs the redirect. -->
        <button
          class="google"
          onclick={() => signInWithGoogle(supabase, window.location.href)}
          type="button"
        >
          <svg class="g" width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
            /><path
              fill="#FF3D00"
              d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"
            /><path
              fill="#4CAF50"
              d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
            /><path
              fill="#1976D2"
              d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
            />
          </svg>
          {strings["continueWithGoogle"]}
        </button>

        <ul class="benefits">
          {#each benefits as b}
            <li class="benefit">
              <span class="benefit-icon">
                {#if b.icon === "sync"}
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="14" height="11" rx="2" /><path d="M7 20h6M10 15v5" /><rect x="17" y="11" width="5" height="9" rx="1.5" /></svg>
                {:else if b.icon === "backup"}
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9c-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2l4-4" /></svg>
                {:else}
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>
                {/if}
              </span>
              <span class="benefit-text">
                <span class="benefit-title">{b.title}</span>
                <span class="benefit-desc">{b.desc}</span>
              </span>
            </li>
          {/each}
        </ul>
      </div>

      <div class="guest">
        <button class="guest-btn" onclick={() => (guest = true)} type="button">
          {strings["continueAsGuest"]}
        </button>
        <p class="guest-note">{strings["guestCarryOverNote"]}</p>
      </div>
    </div>
  </main>
  <footer class="footer">
    <a href="https://cheqii.com/privacy">{strings["privacy"]}</a>
    <span aria-hidden="true">·</span>
    <a href="https://cheqii.com/terms">{strings["terms"]}</a>
  </footer>
{/if}

<style>
  .auth {
    align-items: center;
    display: flex;
    flex: 1;
    justify-content: center;
    padding: var(--space-6) var(--space-4);
  }
  .col {
    inline-size: 100%;
    max-inline-size: 26rem;
  }

  .invite {
    margin-block-end: var(--space-5);
    text-align: center;
  }
  .lead {
    font-size: var(--text-2xl);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
    text-wrap: balance;
  }
  .meta {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    margin: var(--space-1) 0 0;
  }

  .card {
    background: var(--color-background-raised);
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    padding: var(--space-5);
  }

  .google {
    align-items: center;
    background: var(--color-action);
    border: 0;
    border-radius: 100vw;
    color: var(--color-on-action);
    cursor: pointer;
    display: flex;
    font: inherit;
    font-weight: 700;
    gap: var(--space-3);
    inline-size: 100%;
    justify-content: center;
    padding: var(--space-3);

    @media (prefers-reduced-motion: no-preference) {
      transition: background-color var(--dur-fast) var(--ease-standard);
    }
  }
  .google:hover {
    background: var(--color-action-secondary);
  }
  .g {
    background: var(--white);
    border-radius: 50%;
    flex-shrink: 0;
    padding: 2px;
  }

  .benefits {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    list-style: none;
    margin: var(--space-5) 0 0;
    padding: 0;
  }
  .benefit {
    align-items: flex-start;
    display: flex;
    gap: var(--space-3);
  }
  .benefit-icon {
    align-items: center;
    background: var(--color-surface);
    block-size: 2.25rem;
    border-radius: var(--space-2);
    color: var(--color-action);
    display: inline-flex;
    flex-shrink: 0;
    inline-size: 2.25rem;
    justify-content: center;
  }
  .benefit-icon svg {
    block-size: 1.125rem;
    inline-size: 1.125rem;
    stroke: currentColor;
  }
  .benefit-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-0);
  }
  .benefit-title {
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .benefit-desc {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  /* Left-aligned within the still-centered column. */
  .guest {
    margin-block-start: var(--space-5);
    text-align: start;
  }
  .guest-btn {
    background: transparent;
    border: var(--border-divider) solid var(--color-border);
    border-radius: 100vw;
    color: var(--color-text);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    padding: var(--space-2) var(--space-5);

    @media (prefers-reduced-motion: no-preference) {
      transition: border-color var(--dur-fast) var(--ease-standard);
    }
  }
  .guest-btn:hover {
    border-color: var(--color-action);
  }
  .guest-note {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
    margin: var(--space-2) 0 0;
  }

  .footer {
    color: var(--color-text-muted);
    display: flex;
    gap: var(--space-2);
    justify-content: center;
    padding: var(--space-4);
  }
  .footer a {
    color: var(--color-text-muted);
    text-decoration: none;
  }
  .footer a:hover {
    color: var(--color-action);
    text-decoration: underline;
  }
</style>
