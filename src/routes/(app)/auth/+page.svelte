<script lang="ts">
  import { onMount } from "svelte";
  import { goto, invalidate } from "$app/navigation";
  import AnonymousSignIn from "$lib/components/auth/AnonymousSignIn.svelte";
  import SiteHeader from "$lib/components/marketing/SiteHeader.svelte";
  import { isRecoveringIdentity, signInWithGoogle } from "$lib/utils/common/auth.svelte";
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

  // "Invited" only when we actually arrived from an invite link (/invite/... sets
  // authRedirect). The gate also sets authRedirect for plain /cheques access, which
  // is NOT an invite — those visitors get the "start your first cheque" lead.
  const invited = $derived((authRedirect ?? "").startsWith("/invite/"));
  const lead = $derived(
    chequeName
      ? interpolateString(strings["signInToContinueTo{cheque}"], { cheque: chequeName })
      : invited
        ? strings["youreInvitedToJoinACheque"]
        : strings["startYourFirstChequeLead"],
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

  // Offline + logged out: neither Google nor guest sign-in can reach the server
  // (both create/validate a session online), so we show an "offline" screen rather
  // than dead buttons. The choices reappear — and they decide — once back online.
  let online = $state(typeof navigator === "undefined" ? true : navigator.onLine);
  $effect(() => {
    const sync = () => (online = navigator.onLine);
    addEventListener("online", sync);
    addEventListener("offline", sync);
    return () => {
      removeEventListener("online", sync);
      removeEventListener("offline", sync);
    };
  });

  $effect(() => {
    // Don't whisk a guest to /cheques while we're bouncing back through Google to
    // resolve an identity conflict (the layout kicked that off).
    if (session && !isRecoveringIdentity()) void handleRedirect();
  });

  async function handleRedirect() {
    await invalidate("supabase:auth"); // let other components see the new session
    void goto(authRedirect ?? "/cheques", { replaceState: true });
  }

  const benefits = [
    { title: strings["benefitSyncTitle"], desc: strings["benefitSyncDesc"], icon: "sync" },
    { title: strings["benefitCapTitle"], desc: strings["benefitCapDesc"], icon: "cap" },
    { title: strings["benefitBackupTitle"], desc: strings["benefitBackupDesc"], icon: "backup" },
  ] as const;
</script>

{#if guest}
  <!-- Guest chosen → AnonymousSignIn signs in anonymously (with Turnstile) and
       shows its loader until the session lands and the effect above redirects. -->
  <AnonymousSignIn {supabase} />
{:else if !session && !online}
  <!-- Offline + logged out: sign-in can't reach the server. Don't show dead
       buttons — once back online this branch falls through to the choices. -->
  <SiteHeader {strings} />
  <main class="offline">
    <h1 class="lead">{strings["youreOffline"]}</h1>
    <p class="offline-note">{strings["reconnectToContinue"]}</p>
  </main>
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
          {strings["continueWithGoogle"]}
        </button>

        <ul class="benefits">
          {#each benefits as b}
            <li class="benefit">
              <span class="benefit-icon">
                {#if b.icon === "sync"}
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="14" height="11" rx="2" /><path d="M7 20h6M10 15v5" /><rect x="17" y="11" width="5" height="9" rx="1.5" /></svg>
                {:else if b.icon === "cap"}
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
                {:else}
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9c-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2l4-4" /></svg>
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

  /* Offline + logged out — a quiet, centered message (no actionable buttons). */
  .offline {
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    padding: var(--space-6) var(--space-4);
    text-align: center;
  }
  .offline-note {
    color: var(--color-text-muted);
    margin: var(--space-2) 0 0;
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
    background: var(--color-action-hover);
  }
  .google:active {
    background: var(--color-action-active);
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

  .guest {
    margin-block-start: var(--space-5);
    text-align: center;
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
  /* Button stays centered (.guest); only the note text is left-aligned. */
  .guest-note {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
    margin: var(--space-2) 0 0;
    text-align: start;
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
