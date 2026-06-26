/**
 * Per-item allocation: split each item's cost across its contributors by ratio,
 * then apportion bill-level tax/tip proportionally. Pure and currency-agnostic —
 * integer minor units in, structured data out; formatting happens at the render edge.
 *
 * Fixes two v1 bugs (see docs/allocation-spec.md §2):
 *   1. Remainder cents were dropped into `owingUnaccounted` when the rounding
 *      leftover exceeded the contributor count (the cumulative-total MaxHeap
 *      emptied early). v2 uses **largest-remainder (Hamilton) apportionment**,
 *      which places every cent exactly.
 *   2. Splits were matched to contributors by array index; v2 matches by
 *      `contributor_id`, so split order/count need not mirror the contributors.
 */

export interface AllocContributor {
  id: string;
  name: string;
}
export interface AllocSplit {
  contributor_id: string;
  ratio: number;
}
export interface AllocItem {
  id: string;
  name: string;
  cost: number; // minor units
  contributor_id: string; // who paid
  splits: AllocSplit[];
}

interface OwingItem {
  name: string;
  cost: number;
  split: { numerator: number; denominator: number; multiplicand: number };
}
interface Contribution {
  owing: { items: OwingItem[]; total: number };
  paid: { items: { name: string; cost: number }[]; total: number };
}

export interface Allocations {
  contributions: Map<number, Contribution>;
  subtotal: number; // Σ item costs (pre tax/tip)
  tax: number;
  tip: number;
  grandTotal: number; // subtotal + tax + tip
  owingUnaccounted: number; // > 0 only with corrupt data (missing contributor refs)
  paidUnaccounted: number;
}

/**
 * Largest-remainder apportionment. Distribute `amount` across entries weighted by
 * `weights`, returning an integer per entry that sums **exactly** to `amount`.
 * Leftover units go to the largest fractional remainders, ties broken by index
 * (deterministic across devices). Returns all-zeros when total weight is 0.
 */
export function largestRemainder(weights: number[], amount: number): number[] {
  const totalWeight = weights.reduce((a, w) => a + w, 0);
  const out: number[] = Array.from({ length: weights.length }, () => 0);
  if (totalWeight <= 0 || amount === 0) return out;

  const remainders: { index: number; rem: number }[] = [];
  let assigned = 0;
  for (let i = 0; i < weights.length; i++) {
    const product = amount * weights[i];
    out[i] = Math.floor(product / totalWeight);
    assigned += out[i];
    remainders.push({ index: i, rem: product % totalWeight });
  }

  let left = amount - assigned; // 0 ≤ left < weights.length
  remainders.sort((a, b) => b.rem - a.rem || a.index - b.index);
  for (let k = 0; k < remainders.length && left > 0; k++) {
    out[remainders[k].index] += 1;
    left--;
  }
  return out;
}

export function allocate(
  contributors: AllocContributor[],
  items: AllocItem[],
  taxTip: { tax: number; tip: number } = { tax: 0, tip: 0 },
): Allocations {
  const indexById = new Map<string, number>();
  const contributions = new Map<number, Contribution>();
  for (let i = 0; i < contributors.length; i++) {
    indexById.set(contributors[i].id, i);
    contributions.set(i, {
      owing: { items: [], total: 0 },
      paid: { items: [], total: 0 },
    });
  }

  let subtotal = 0;
  for (const item of items) {
    const splitTotal = item.splits.reduce((a, s) => a + s.ratio, 0);

    if (item.cost && splitTotal) {
      // Exact per-split owing — every minor unit placed, none dropped.
      const owings = largestRemainder(
        item.splits.map((s) => s.ratio),
        item.cost,
      );
      for (let i = 0; i < item.splits.length; i++) {
        const idx = indexById.get(item.splits[i].contributor_id);
        const contribution = idx === undefined ? undefined : contributions.get(idx);
        // A split for a missing contributor is simply not placed; the end-state
        // reconciliation books the gap as owingUnaccounted.
        if (contribution) {
          contribution.owing.items.push({
            name: item.name,
            cost: owings[i],
            split: {
              numerator: item.splits[i].ratio,
              denominator: splitTotal,
              multiplicand: item.cost,
            },
          });
          contribution.owing.total += owings[i];
        }
      }
    }

    // Payer accrues the full item cost (only meaningful when there is a cost).
    if (item.cost) {
      const payerIdx = indexById.get(item.contributor_id);
      const payer = payerIdx === undefined ? undefined : contributions.get(payerIdx);
      if (payer) {
        payer.paid.items.push({ name: item.name, cost: item.cost });
        payer.paid.total += item.cost;
      }
      subtotal += item.cost;
    }
  }

  const { tax, tip } = taxTip;
  const combined = tax + tip;
  if (combined > 0) {
    applyTaxTip(contributors.length, contributions, combined, "owing");
    applyTaxTip(contributors.length, contributions, combined, "paid");
  }

  // Single source of truth for "unaccounted": anything in the grand total not
  // placed on a contributor. Captures missing contributor/payer refs and the
  // indivisible leftover from the degenerate subtotal-0 tax/tip equal split.
  const grandTotal = subtotal + tax + tip;
  return {
    contributions,
    subtotal,
    tax,
    tip,
    grandTotal,
    owingUnaccounted: grandTotal - sumSide(contributions, "owing"),
    paidUnaccounted: grandTotal - sumSide(contributions, "paid"),
  };
}

/**
 * Apportion combined tax+tip across contributors in proportion to their `side`
 * subtotal (largest-remainder, exact). When the side total is 0 (no costed items
 * on that side), fall back to an equal split; the indivisible leftover stays
 * unplaced and surfaces as unaccounted via the grand-total reconciliation.
 */
function applyTaxTip(
  count: number,
  contributions: Map<number, Contribution>,
  combined: number,
  side: "owing" | "paid",
): void {
  const weights: number[] = [];
  for (let i = 0; i < count; i++) weights.push(contributions.get(i)![side].total);
  const totalWeight = weights.reduce((a, w) => a + w, 0);

  const shares =
    totalWeight > 0 ? largestRemainder(weights, combined) : equalSplit(count, combined);
  for (let i = 0; i < count; i++) contributions.get(i)![side].total += shares[i];
}

/** Equal split with the indivisible remainder left out (booked as unaccounted). */
function equalSplit(count: number, amount: number): number[] {
  if (count === 0) return [];
  const each = Math.floor(amount / count);
  return Array.from({ length: count }, () => each);
}

function sumSide(contributions: Map<number, Contribution>, side: "owing" | "paid"): number {
  let sum = 0;
  for (const c of contributions.values()) sum += c[side].total;
  return sum;
}
