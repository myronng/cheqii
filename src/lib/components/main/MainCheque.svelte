<!--
  A single cheque preview card for the listing grid. Everything shown is derived
  from the in-memory snapshot (no fetch): title, item count + relative time,
  member avatars, an item preview, the grand total, and the signed-in user's
  standing (owed / owe / claim-your-spot) via chequeSummary().
-->
<script lang="ts">
  import Avatar from "$lib/components/base/Avatar.svelte";
  import { type ChequeData, chequeSummary } from "$lib/state/model";
  import {
    AMOUNT_FORMATTER,
    formatRelativeTime,
    getNumericDisplay,
  } from "$lib/utils/common/formatter";
  import { type LocalizedStrings, interpolateString } from "$lib/utils/common/locale";

  let {
    cheque,
    userId,
    strings,
  }: { cheque: ChequeData; userId: string; strings: LocalizedStrings } = $props();

  // Brand-green palette for member discs (cycled by position).
  const AVATAR_COLORS = ["#529471", "#83cc61", "#385455", "#6bae7e", "#4a7d63"];

  const members = $derived(cheque.cheque_contributors.filter((c) => !c.is_stub));
  const shownMembers = $derived(members.slice(0, 4));
  const extraMembers = $derived(members.length - shownMembers.length);

  const items = $derived(cheque.cheque_items.filter((i) => !i.is_stub));
  const shownItems = $derived(items.slice(0, 3));
  const moreItems = $derived(items.length - shownItems.length);

  const summary = $derived(chequeSummary(cheque, userId));
  const amount = $derived(getNumericDisplay(AMOUNT_FORMATTER, summary.total));
  const meta = $derived(
    `${interpolateString(strings["{count}Items"], { count: String(items.length) })} · ${formatRelativeTime(cheque.updated_at)}`,
  );
</script>

<a class="card" href={`/cheques/${cheque.id}`}>
  <div class="head">
    <div class="titles">
      <div class="title">{cheque.name}</div>
      <div class="meta">{meta}</div>
    </div>
    <div class="avatars">
      {#each shownMembers as member, i}
        <span class="avatar">
          <Avatar
            name={member.name ?? ""}
            color={AVATAR_COLORS[i % AVATAR_COLORS.length]}
            size="1.625rem"
          />
        </span>
      {/each}
      {#if extraMembers > 0}
        <span class="extra">+{extraMembers}</span>
      {/if}
    </div>
  </div>

  <div class="items">
    {#each shownItems as item}
      <div class="item">
        <span class="item-name">{item.name}</span>
        <span class="item-amount">{getNumericDisplay(AMOUNT_FORMATTER, item.cost ?? 0)}</span>
      </div>
    {/each}
    {#if moreItems > 0}
      <div class="more">
        {interpolateString(strings["plus{count}More"], { count: String(moreItems) })}
      </div>
    {/if}
  </div>

  <div class="footer">
    <div class="balance">
      {#if summary.balance.state === "unlinked"}
        <span class="claim">{strings["claimYourSpot"]}</span>
      {:else}
        <div class="balance-label">
          {summary.balance.state === "owe" ? strings["youOwe"] : strings["youreOwed"]}
        </div>
        <div class="balance-value" class:owe={summary.balance.state === "owe"}>
          {summary.balance.state === "owe" ? "−" : "+"}{getNumericDisplay(
            AMOUNT_FORMATTER,
            summary.balance.amount,
          )}
        </div>
      {/if}
    </div>
    <div class="total">
      <div class="total-label">{strings["total"]}</div>
      <div class="total-value">{amount}</div>
    </div>
  </div>
</a>

<style>
  .card {
    background: var(--color-background-raised);
    border: var(--border-divider) solid var(--color-border);
    border-radius: var(--radius-card);
    color: var(--color-text);
    display: flex;
    flex-direction: column;
    min-block-size: 14rem;
    padding: var(--space-5);
    text-decoration: none;
    transition: border-color var(--dur-base) var(--ease-standard);
  }
  .card:hover {
    border-color: var(--color-action);
  }

  .head {
    align-items: flex-start;
    display: flex;
    gap: var(--space-3);
    justify-content: space-between;
  }
  .titles {
    min-inline-size: 0;
  }
  .title {
    font-size: var(--text-lg);
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    margin-block-start: var(--space-0);
  }

  .avatars {
    align-items: center;
    display: flex;
    flex-shrink: 0;
  }
  /* Overlap the discs; the outline masks the seam against the card. */
  .avatar {
    border-radius: 50%;
    display: inline-flex;
    margin-inline-start: calc(var(--space-2) * -1);
    outline: var(--border-divider) solid var(--color-background-raised);
  }
  .extra {
    align-items: center;
    background: var(--color-surface);
    border-radius: 100vw;
    color: var(--color-text-muted);
    display: inline-flex;
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-sm);
    margin-inline-start: calc(var(--space-2) * -1);
    min-inline-size: 1.625rem;
    outline: var(--border-divider) solid var(--color-background-raised);
    padding: var(--space-0) var(--space-2);
  }

  .items {
    margin-block-start: var(--space-4);
    /* Match the inter-item gap below the list (e.g. "+N more") before the footer
       divider, so the divider isn't hugged tighter than items are spaced. */
    padding-block-end: var(--space-2);
  }
  .item {
    align-items: center;
    display: flex;
    font-size: var(--text-sm);
    gap: var(--space-3);
    justify-content: space-between;
    padding: var(--space-1) 0;
  }
  .item-name {
    color: var(--color-text);
    opacity: 0.78;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item-amount {
    color: var(--color-text-muted);
    flex-shrink: 0;
    font-family: "JetBrains Mono", monospace;
  }
  .more {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    padding-block-start: var(--space-1);
  }

  .footer {
    align-items: flex-end;
    border-block-start: var(--border-divider) solid var(--color-border);
    display: flex;
    gap: var(--space-3);
    justify-content: space-between;
    margin-block-start: auto;
    padding-block-start: var(--space-3);
  }
  .balance {
    min-inline-size: 0;
  }
  .balance-label,
  .total-label {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .balance-value {
    color: var(--color-action);
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-xl);
    font-weight: 700;
  }
  .balance-value.owe {
    color: var(--color-feedback-error);
  }
  .claim {
    align-items: center;
    border: var(--border-divider) solid var(--color-border);
    border-radius: 100vw;
    color: var(--color-text-muted);
    display: inline-flex;
    font-size: var(--text-sm);
    font-weight: 600;
    padding: var(--space-1) var(--space-3);
  }
  .total {
    flex-shrink: 0;
    text-align: end;
  }
  .total-value {
    font-family: "JetBrains Mono", monospace;
    font-size: var(--text-base);
  }
</style>
