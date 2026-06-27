<!--
  Cheqii — landing hero (Direction A: editorial split).
  Reuses the app's design tokens (semantic vars from app.css), Logo component, and
  localized strings — NOT a standalone implementation. The one intentional addition
  is the glow on the primary CTA.
-->
<script lang="ts">
  import Logo from "$lib/components/base/Logo.svelte";
  import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";

  let {
    strings,
    appUrl = "https://app.cheqii.com",
  }: { strings: LocalizedStrings; appUrl?: string } = $props();

  const eyebrow = interpolateString(strings["a{collaborative}BillSplitter"], {
    collaborative: strings["collaborative"],
  });

  const steps = [
    { n: "01", title: strings["startACheque"], desc: strings["landingStartDescription"] },
    { n: "02", title: strings["addItems"], desc: strings["landingAddDescription"] },
    { n: "03", title: strings["settleUp"], desc: strings["landingSettleDescription"] },
  ];

  // Illustrative sample data for the product mock (demo content, not UI chrome).
  const chequeTitle = "Tofino weekend";
  const people = [
    { initial: "M", color: "#529471" },
    { initial: "S", color: "#83cc61" },
    { initial: "J", color: "#385455" },
    { initial: "A", color: "#6bae7e" },
  ];
  const items = [
    { name: "Cabin · 2 nights", meta: "Maya paid · split 4 ways", amount: "320.00" },
    { name: "Groceries", meta: "Sam paid · split 4 ways", amount: "86.40" },
    { name: "Gas", meta: "Jordan paid · split 3 ways", amount: "54.00" },
  ];
  const transfers = [
    { from: "Jordan", to: "Maya", amount: "64.10" },
    { from: "Ana", to: "Maya", amount: "101.60" },
  ];
</script>

<section class="hero">
  <nav class="nav">
    <Logo {strings} />
    <a class="nav-link" href={appUrl}>{strings["signIn"]}</a>
  </nav>

  <div class="main">
    <div class="copy">
      <span class="eyebrow"><span class="dot"></span>{eyebrow}</span>
      <h1 class="headline">{strings["landingHeadline"]}</h1>
      <p class="sub">{strings["landingSubtitle"]}</p>

      <div class="cta-row">
        <a class="btn primary" href={appUrl}>{strings["startACheque"]}</a>
        <a class="btn ghost" href={appUrl}>{strings["signInWithGoogle"]}</a>
      </div>

      <div class="steps">
        {#each steps as step}
          <div class="step">
            <div class="step-n">{step.n}</div>
            <div class="step-title">{step.title}</div>
            <div class="step-desc">{step.desc}</div>
          </div>
        {/each}
      </div>
    </div>

    <!-- product mock -->
    <div class="mock-wrap">
      <div class="mock-glow" aria-hidden="true"></div>
      <div class="mock">
        <div class="mock-head">
          <div>
            <div class="mock-title">{chequeTitle}</div>
            <div class="mock-live">
              <span class="pulse"></span>{interpolateString(strings["{count}PeopleLive"], {
                count: String(people.length),
              })}
            </div>
          </div>
          <div class="avatars">
            {#each people as p}
              <span class="avatar" style="background:{p.color}">{p.initial}</span>
            {/each}
          </div>
        </div>

        {#each items as it}
          <div class="item">
            <div>
              <div class="item-name">{it.name}</div>
              <div class="item-meta">{it.meta}</div>
            </div>
            <span class="amount">{it.amount}</span>
          </div>
        {/each}

        <div class="settle-head">
          <span class="settle-title">{strings["settleUp"]}</span>
          <span class="badge">{interpolateString(strings["{count}Payments"], { count: "2" })}</span>
        </div>

        {#each transfers as t}
          <div class="transfer">
            <div class="transfer-who">
              <span>{t.from}</span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="arrow"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              <span>{t.to}</span>
            </div>
            <span class="transfer-amt">{t.amount}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .hero {
    background: var(--color-background);
    color: var(--color-text);
    display: flex;
    flex-direction: column;
    min-block-size: 100dvh;
  }

  .nav {
    align-items: center;
    display: flex;
    justify-content: space-between;
    padding: var(--space-5) var(--space-6);
  }
  .nav-link {
    color: var(--color-text);
    font-size: var(--text-sm);
    text-decoration: none;
  }

  .main {
    align-items: center;
    display: flex;
    flex: 1;
    gap: calc(var(--space-6) + var(--space-5));
    inline-size: 100%;
    margin: 0 auto;
    max-inline-size: 80rem;
    padding: var(--space-2) var(--space-6) calc(var(--space-6) + var(--space-2));
  }
  .copy {
    flex: 1;
    min-inline-size: 0;
  }

  .eyebrow {
    align-items: center;
    background: var(--color-surface);
    border-radius: 100vw;
    color: var(--color-text-muted);
    display: inline-flex;
    font-size: var(--text-sm);
    gap: var(--space-2);
    margin-block-end: var(--space-5);
    padding: var(--space-1) var(--space-3);
  }
  .dot {
    background: var(--color-action);
    block-size: var(--space-1);
    border-radius: 50%;
    inline-size: var(--space-1);
  }

  .headline {
    font-size: var(--text-5xl);
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.06;
    margin: 0 0 var(--space-4);
    text-wrap: balance;
  }
  .sub {
    color: var(--color-text-muted);
    font-size: var(--text-lg);
    line-height: 1.55;
    margin: 0 0 var(--space-6);
    max-inline-size: 28rem;
  }

  .cta-row {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-block-end: calc(var(--space-6) + var(--space-3));
  }
  .btn {
    align-items: center;
    border-radius: 100vw;
    cursor: pointer;
    display: inline-flex;
    font-size: var(--text-base);
    font-weight: 700;
    text-decoration: none;
    transition:
      transform var(--dur-fast) var(--ease-standard),
      box-shadow var(--dur-base) var(--ease-standard);
  }
  .btn:active {
    transform: translateY(1px);
  }
  .btn.primary {
    background: var(--color-action);
    color: var(--white);
    padding: var(--space-3) var(--space-5);
    /* the one kept addition: a soft brand-green halo */
    box-shadow: 0 var(--space-2) calc(var(--space-5) + var(--space-1)) calc(var(--space-0) * -1)
      var(--color-action);
  }
  .btn.primary:hover {
    box-shadow: 0 var(--space-3) calc(var(--space-6) - var(--space-1)) 0 var(--color-action);
  }
  .btn.ghost {
    border: var(--border-divider) solid var(--color-border);
    color: var(--color-text);
    padding: var(--space-3) var(--space-4);
  }

  .steps {
    display: flex;
    gap: var(--space-3);
  }
  .step {
    background: var(--color-surface);
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    flex: 1;
    padding: var(--space-4);
  }
  .step-n {
    color: var(--color-action);
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-sm);
    font-weight: 700;
    margin-block-end: var(--space-2);
  }
  .step-title {
    font-size: var(--text-base);
    font-weight: 600;
    margin-block-end: var(--space-0);
  }
  .step-desc {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.4;
  }

  /* product mock */
  .mock-wrap {
    flex-shrink: 0;
    inline-size: 27rem;
    position: relative;
  }
  .mock-glow {
    background: radial-gradient(circle at 60% 40%, var(--color-action), transparent 70%);
    filter: blur(30px);
    inset: -40px -20px -20px;
    opacity: 0.13;
    position: absolute;
  }
  .mock {
    background: var(--color-background-raised);
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    box-shadow: 0 30px 60px -28px var(--color-backdrop);
    padding: var(--space-5);
    position: relative;
  }
  .mock-head {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-block-end: var(--space-4);
  }
  .mock-title {
    font-size: var(--text-lg);
    font-weight: 700;
  }
  .mock-live {
    align-items: center;
    color: var(--color-text-muted);
    display: flex;
    font-size: var(--text-sm);
    gap: var(--space-2);
    margin-block-start: var(--space-0);
  }
  .pulse {
    animation: heroPulse 1.8s ease-in-out infinite;
    background: var(--color-action);
    block-size: var(--space-2);
    border-radius: 50%;
    inline-size: var(--space-2);
  }

  .avatars {
    align-items: center;
    display: flex;
  }
  .avatar {
    align-items: center;
    block-size: var(--space-6);
    border: var(--border-divider) solid var(--color-background-raised);
    border-radius: 50%;
    color: var(--white);
    display: inline-flex;
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-sm);
    font-weight: 700;
    inline-size: var(--space-6);
    justify-content: center;
    margin-inline-start: calc(var(--space-2) * -1);
  }

  .item {
    align-items: center;
    border-block-end: var(--border-divider) solid var(--color-border);
    display: flex;
    justify-content: space-between;
    padding: var(--space-3) 0;
  }
  .item-name {
    font-size: var(--text-base);
  }
  .item-meta {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    margin-block-start: var(--space-0);
  }
  .amount {
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-base);
  }

  .settle-head {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin: var(--space-4) 0 var(--space-3);
  }
  .settle-title {
    font-size: var(--text-base);
    font-weight: 700;
  }
  .badge {
    background: var(--color-action);
    border-radius: 100vw;
    color: var(--white);
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-sm);
    padding: var(--space-0) var(--space-2);
  }

  .transfer {
    align-items: center;
    background: var(--color-surface);
    border-radius: var(--radius-card);
    display: flex;
    justify-content: space-between;
    margin-block-end: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }
  .transfer-who {
    align-items: center;
    display: flex;
    font-size: var(--text-sm);
    gap: var(--space-2);
  }
  .arrow {
    color: var(--color-text-muted);
  }
  .transfer-amt {
    color: var(--color-action);
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-base);
    font-weight: 700;
  }

  @keyframes heroPulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.7);
    }
  }

  @media screen and (max-width: 900px) {
    .main {
      align-items: stretch;
      flex-direction: column;
    }
    .mock-wrap {
      inline-size: 100%;
    }
    .headline {
      font-size: var(--text-4xl);
    }
  }
</style>
