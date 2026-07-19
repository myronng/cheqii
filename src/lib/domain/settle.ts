/**
 * Debt settlement: turn net balances into concrete transfers ("Alice → Bob $12.30").
 * Pure — the UI maps `Transfer[]` to localized strings; no formatting here.
 *
 * Greedy largest-debtor ↔ largest-creditor matching, terminating in ≤ n−1 transfers.
 * Minimal transfers is NP-hard and an explicit non-goal; greedy is near-optimal in
 * practice. Tie-breaking is by person index so every device produces the same
 * list (matters for the sync engine's convergence). See docs/allocation-spec.md §3.
 */
import type { Allocations } from "./allocate";

export interface Transfer {
  fromIndex: number; // debtor
  toIndex: number; // creditor
  amount: number; // minor units, > 0
}

export interface Settlement {
  transfers: Transfer[];
  /** Non-zero only with corrupt allocation data; surfaced rather than absorbed. */
  owingUnaccounted: number;
  paidUnaccounted: number;
}

export function settle(allocations: Allocations): Settlement {
  const debtors: { index: number; amount: number }[] = []; // owe money (balance < 0)
  const creditors: { index: number; amount: number }[] = []; // are owed (balance > 0)

  for (const [index, c] of allocations.contributions) {
    const balance = c.paid.total - c.owing.total;
    if (balance < 0) debtors.push({ index, amount: -balance });
    else if (balance > 0) creditors.push({ index, amount: balance });
  }

  // Largest first; ties broken by index for cross-device determinism.
  const byAmountThenIndex = (
    a: { index: number; amount: number },
    b: { index: number; amount: number },
  ) => b.amount - a.amount || a.index - b.index;
  debtors.sort(byAmountThenIndex);
  creditors.sort(byAmountThenIndex);

  const transfers: Transfer[] = [];
  let d = 0;
  let cr = 0;
  while (d < debtors.length && cr < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[cr];
    const amount = Math.min(debtor.amount, creditor.amount);
    transfers.push({ fromIndex: debtor.index, toIndex: creditor.index, amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
    // Each transfer zeroes at least one side, so we always advance — ≤ n−1 total.
    if (debtor.amount === 0) d++;
    if (creditor.amount === 0) cr++;
  }

  return {
    transfers,
    owingUnaccounted: allocations.owingUnaccounted,
    paidUnaccounted: allocations.paidUnaccounted,
  };
}
