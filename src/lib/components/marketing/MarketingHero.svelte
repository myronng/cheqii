<!--
  Cheqii — landing hero (Direction A: editorial split)
  Scoped CSS. Colours are driven by light-dark() via local --ck-* vars seeded
  from the resolved design tokens (docs/design-tokens.json), so it's drop-in.
  Requires color-scheme: light dark in effect + Comfortaa / JetBrains Mono loaded.
-->
<script lang="ts">
  let {
    headline = "Settle up in the fewest payments.",
    chequeTitle = "Tofino weekend",
    appUrl = "https://app.cheqii.com",
  }: { headline?: string; chequeTitle?: string; appUrl?: string } = $props();

  const people = [
    { initial: "M", color: "#529471" },
    { initial: "S", color: "#83CC61" },
    { initial: "J", color: "#385455" },
    { initial: "A", color: "#6BAE7E" },
  ];

  const steps = [
    { n: "01", title: "Start a cheque", desc: "As a guest. No account, no friction." },
    { n: "02", title: "Add items", desc: "Cost, who paid, and who splits each." },
    { n: "03", title: "Settle up", desc: "Fewest payments, exact to the cent." },
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

<section class="cheqii-hero">
  <!-- nav -->
  <nav class="nav">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"><path d="M5 12.5l4 4 10-11" /></svg>
      </span>
      <span class="brand-name">cheqii</span>
    </div>
    <a class="nav-link" href={appUrl}>Sign in</a>
  </nav>

  <!-- main -->
  <div class="main">
    <div class="copy">
      <span class="eyebrow"><span class="dot"></span>A collaborative cost splitter</span>
      <h1 class="headline">{headline}</h1>
      <p class="sub">
        Split any group purchase together, in real time. Cheqii nets every balance into the smallest
        set of payments — exact to the last cent.
      </p>

      <div class="cta-row">
        <a class="btn btn-primary" href={appUrl}>Start a cheque</a>
        <a class="btn btn-ghost" href={appUrl}>Sign in with Google</a>
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
            <div class="mock-live"><span class="pulse"></span>4 people · live</div>
          </div>
          <div class="avatars">
            {#each people as p}
              <span class="avatar" style="background:{p.color}">{p.initial}</span>
            {/each}
          </div>
        </div>

        {#each items as it}
          <div class="row item">
            <div>
              <div class="item-name">{it.name}</div>
              <div class="item-meta">{it.meta}</div>
            </div>
            <span class="amount">{it.amount}</span>
          </div>
        {/each}

        <div class="settle-head">
          <span class="settle-title">Settle up</span>
          <span class="badge">2 payments</span>
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
  .cheqii-hero {
    /* --- local theme tokens (swap for global vars if preferred) --- */
    --ck-bg: light-dark(#e5f1e3, #304d4e);
    --ck-bg-raised: light-dark(#dce8da, #385455);
    --ck-text: light-dark(#304d4e, #e5f1e3);
    --ck-muted: light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.55));
    --ck-surface: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.06));
    --ck-surface-2: light-dark(rgba(0, 0, 0, 0.04), rgba(255, 255, 255, 0.05));
    --ck-border: light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.12));
    --ck-action: light-dark(#529471, #83cc61);
    --ck-on-action: light-dark(#ffffff, #22383a);

    color-scheme: light dark;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--ck-bg);
    color: var(--ck-text);
    font-family: "Comfortaa", sans-serif;
  }
  .cheqii-hero *,
  .cheqii-hero *::before,
  .cheqii-hero *::after {
    box-sizing: border-box;
  }

  /* nav */
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 26px 48px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 11px;
  }
  .brand-mark {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: var(--ck-action);
    color: var(--ck-on-action);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .brand-name {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .nav-link {
    font-size: 14px;
    color: var(--ck-text);
    text-decoration: none;
    cursor: pointer;
  }

  /* main layout */
  .main {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 56px;
    padding: 8px 48px 40px;
    max-width: 1280px;
    width: 100%;
    margin: 0 auto;
  }
  .copy {
    flex: 1;
    min-width: 0;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 13px;
    border-radius: 100px;
    background: var(--ck-surface);
    font-size: 12.5px;
    color: var(--ck-muted);
    margin-bottom: 24px;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ck-action);
  }

  .headline {
    font-size: 54px;
    line-height: 1.06;
    font-weight: 700;
    letter-spacing: -0.025em;
    margin: 0 0 20px;
    text-wrap: balance;
  }
  .sub {
    font-size: 18px;
    line-height: 1.55;
    color: var(--ck-muted);
    margin: 0 0 32px;
    max-width: 440px;
  }

  /* buttons */
  .cta-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 44px;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    border-radius: 100px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition:
      transform 0.075s cubic-bezier(0.2, 0, 0, 1),
      box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
  }
  .btn:active {
    transform: translateY(1px);
  }
  .btn-primary {
    padding: 15px 26px;
    font-size: 15.5px;
    background: var(--ck-action);
    color: var(--ck-on-action);
    box-shadow: 0 6px 22px -2px var(--ck-action);
  }
  .btn-primary:hover {
    box-shadow: 0 8px 28px 0 var(--ck-action);
  }
  .btn-ghost {
    padding: 14px 22px;
    font-size: 15px;
    font-weight: 600;
    color: var(--ck-text);
    border: 1.5px solid var(--ck-border);
  }

  /* steps */
  .steps {
    display: flex;
    gap: 14px;
  }
  .step {
    flex: 1;
    padding: 16px;
    border-radius: 16px;
    background: var(--ck-surface-2);
    border: 1px solid var(--ck-border);
  }
  .step-n {
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    font-weight: 700;
    color: var(--ck-action);
    margin-bottom: 8px;
  }
  .step-title {
    font-size: 14.5px;
    font-weight: 600;
    margin-bottom: 3px;
  }
  .step-desc {
    font-size: 12.5px;
    line-height: 1.4;
    color: var(--ck-muted);
  }

  /* product mock */
  .mock-wrap {
    width: 430px;
    flex-shrink: 0;
    position: relative;
  }
  .mock-glow {
    position: absolute;
    inset: -40px -20px -20px;
    background: radial-gradient(circle at 60% 40%, var(--ck-action), transparent 70%);
    opacity: 0.13;
    filter: blur(30px);
  }
  .mock {
    position: relative;
    background: var(--ck-bg-raised);
    border: 1px solid var(--ck-border);
    border-radius: 22px;
    padding: 22px;
    box-shadow: 0 30px 60px -28px rgba(48, 77, 78, 0.5);
  }
  .mock-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
  }
  .mock-title {
    font-size: 17px;
    font-weight: 700;
  }
  .mock-live {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--ck-muted);
    margin-top: 3px;
  }
  .pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ck-action);
    animation: cheqPulse 1.8s ease-in-out infinite;
  }

  .avatars {
    display: flex;
    align-items: center;
  }
  .avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    color: #fff;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: -7px;
    border: 2px solid var(--ck-bg-raised);
  }

  .row.item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 13px 0;
    border-bottom: 1px solid var(--ck-border);
  }
  .item-name {
    font-size: 14.5px;
    font-weight: 500;
  }
  .item-meta {
    font-size: 11.5px;
    color: var(--ck-muted);
    margin-top: 2px;
  }
  .amount {
    font-family: "JetBrains Mono", monospace;
    font-size: 14.5px;
  }

  .settle-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 18px 0 12px;
  }
  .settle-title {
    font-size: 13px;
    font-weight: 700;
  }
  .badge {
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    padding: 3px 9px;
    border-radius: 100px;
    background: var(--ck-action);
    color: var(--ck-on-action);
  }

  .transfer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 13px;
    border-radius: 13px;
    background: var(--ck-surface-2);
    margin-bottom: 7px;
  }
  .transfer-who {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 13.5px;
  }
  .arrow {
    color: var(--ck-muted);
  }
  .transfer-amt {
    font-family: "JetBrains Mono", monospace;
    font-size: 14px;
    font-weight: 700;
    color: var(--ck-action);
  }

  @keyframes cheqPulse {
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

  /* responsive: stack on narrow screens */
  @media (max-width: 900px) {
    .main {
      flex-direction: column;
      align-items: stretch;
    }
    .mock-wrap {
      width: 100%;
    }
    .headline {
      font-size: 40px;
    }
  }
</style>
