<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import SiteHeader from "$lib/components/marketing/SiteHeader.svelte";
  import { isRecoveringIdentity, signInWithGoogle } from "$lib/utils/common/auth.svelte";
  import { DEFAULT_LOCALE, LOCALE_MASTER } from "$lib/utils/common/locale";

  // The guest-cap wall (mirrors /auth): both blocked flows land here — creating a
  // 7th cheque (/new redirects with no params) and joining one via an invite
  // (/invite/[chequeId] redirects with ?invite=, keeping its token stashed so the
  // join can resume). Where /auth offers "Continue as guest", this page instead
  // explains the cap and offers the way back to the cheque list.
  const strings = LOCALE_MASTER[DEFAULT_LOCALE];
  const supabase = $derived(page.data.supabase);
  const inviteChequeId = $derived(page.url.searchParams.get("invite"));

  // Where Google lands after sign-in: back into the interrupted flow. The invite
  // page re-reads its stashed token and completes the join; /new finishes creating.
  const resumeUrl = $derived(
    inviteChequeId
      ? `${page.url.origin}/invite/${inviteChequeId}`
      : `${page.url.origin}/new`,
  );

  // The cap only applies to guests — a signed-in visitor has nothing to see here.
  // (Stand down while the layout is bouncing through Google to resolve an
  // identity conflict, same as /auth.)
  $effect(() => {
    if (page.data.session && !page.data.session.user.is_anonymous && !isRecoveringIdentity()) {
      void goto("/cheques", { replaceState: true });
    }
  });

  const benefits = [
    { title: strings["benefitSyncTitle"], desc: strings["benefitSyncDesc"], icon: "sync" },
    { title: strings["benefitCapTitle"], desc: strings["benefitCapDesc"], icon: "cap" },
    { title: strings["benefitBackupTitle"], desc: strings["benefitBackupDesc"], icon: "backup" },
  ] as const;
</script>

<SiteHeader {strings} />
<main class="limit">
  <div class="col">
    <div class="intro">
      <h1 class="lead">{strings["guestChequeLimitTitle"]}</h1>
    </div>

    <div class="card">
      <button
        class="google"
        onclick={() => signInWithGoogle(supabase, resumeUrl)}
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

    <div class="back">
      <a class="back-btn" href="/">{strings["backToYourCheques"]}</a>
      <p class="back-note">{strings["guestChequeLimitBody"]}</p>
    </div>
  </div>
</main>
<footer class="footer">
  <a href="https://cheqii.com/privacy">{strings["privacy"]}</a>
  <span aria-hidden="true">·</span>
  <a href="https://cheqii.com/terms">{strings["terms"]}</a>
</footer>

<style>
  .limit {
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

  .intro {
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

  /* Where /auth puts "Continue as guest": the way back, plus why they're here. */
  .back {
    margin-block-start: var(--space-5);
    text-align: center;
  }
  .back-btn {
    background: transparent;
    border: var(--border-divider) solid var(--color-border);
    border-radius: 100vw;
    color: var(--color-text);
    cursor: pointer;
    display: inline-block;
    font: inherit;
    font-weight: 700;
    padding: var(--space-2) var(--space-5);
    text-decoration: none;

    @media (prefers-reduced-motion: no-preference) {
      transition: border-color var(--dur-fast) var(--ease-standard);
    }
  }
  .back-btn:hover {
    border-color: var(--color-action);
  }
  .back-note {
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
