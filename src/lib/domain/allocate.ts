/**
 * Per-item allocation: split each item's cost across its people by ratio.
 * Line items are entered tax/tip-inclusive (final amounts), so there is no
 * cheque-level tax/tip apportionment. Pure and currency-agnostic — integer minor
 * units in, structured data out; formatting happens at the render edge.
 *
 * Fixes two v1 bugs (see docs/allocation-spec.md §2):
 *   1. Remainder cents were dropped into `owingUnaccounted` when the rounding
 *      leftover exceeded the person count (the cumulative-total MaxHeap
 *      emptied early). v2 uses **largest-remainder (Hamilton) apportionment**,
 *      which places every cent exactly.
 *   2. Splits were matched to people by array index; v2 matches by
 *      `person_id`, so split order/count need not mirror the people.
 */

export interface AllocPerson {
  id: string;
  name: string;
}
export interface AllocSplit {
  person_id: string;
  ratio: number;
}
export interface AllocItem {
  id: string;
  name: string;
  cost: number; // minor units
  person_id: string; // who paid
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
  subtotal: number; // Σ item costs
  grandTotal: number; // == subtotal (items are entered tax/tip-inclusive)
  owingUnaccounted: number; // > 0 only with corrupt data (missing person refs)
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

export function allocate(people: AllocPerson[], items: AllocItem[]): Allocations {
  const indexById = new Map<string, number>();
  const contributions = new Map<number, Contribution>();
  for (let i = 0; i < people.length; i++) {
    indexById.set(people[i].id, i);
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
        const idx = indexById.get(item.splits[i].person_id);
        const contribution = idx === undefined ? undefined : contributions.get(idx);
        // A split for a missing person is simply not placed; the end-state
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
      const payerIdx = indexById.get(item.person_id);
      const payer = payerIdx === undefined ? undefined : contributions.get(payerIdx);
      if (payer) {
        payer.paid.items.push({ name: item.name, cost: item.cost });
        payer.paid.total += item.cost;
      }
      subtotal += item.cost;
    }
  }

  // Single source of truth for "unaccounted": anything in the grand total not
  // placed on a person. Captures missing person/payer refs.
  const grandTotal = subtotal;
  return {
    contributions,
    subtotal,
    grandTotal,
    owingUnaccounted: grandTotal - sumSide(contributions, "owing"),
    paidUnaccounted: grandTotal - sumSide(contributions, "paid"),
  };
}

function sumSide(contributions: Map<number, Contribution>, side: "owing" | "paid"): number {
  let sum = 0;
  for (const c of contributions.values()) sum += c[side].total;
  return sum;
}
