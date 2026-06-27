import { describe, expect, it } from "vitest";
import { type AllocContributor, type AllocItem, allocate, largestRemainder } from "./allocate";

// ---- helpers ----------------------------------------------------------------
function contributors(...names: string[]): AllocContributor[] {
  return names.map((name, i) => ({ id: `c${i}`, name }));
}
function item(cost: number, payer: string, splits: Record<string, number>): AllocItem {
  return {
    id: `i-${cost}-${payer}`,
    name: `item ${cost}`,
    cost,
    contributor_id: payer,
    splits: Object.entries(splits).map(([contributor_id, ratio]) => ({ contributor_id, ratio })),
  };
}
const owingTotals = (a: ReturnType<typeof allocate>) =>
  [...a.contributions.values()].map((c) => c.owing.total);
const paidTotals = (a: ReturnType<typeof allocate>) =>
  [...a.contributions.values()].map((c) => c.paid.total);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

// ---- largestRemainder -------------------------------------------------------
describe("largestRemainder", () => {
  it("sums to the amount exactly and stays within 1 of the exact share", () => {
    const out = largestRemainder([3, 4], 10); // 30/7=4.28, 40/7=5.71
    expect(sum(out)).toBe(10);
    expect(out).toEqual([4, 6]);
  });
  it("distributes a leftover larger than the entry count", () => {
    // remainder cents = 10, 3 entries — v1's heap would have dropped 7 cents
    const out = largestRemainder([1, 1, 1], 100);
    expect(sum(out)).toBe(100);
    expect(out).toEqual([34, 33, 33]);
  });
  it("returns zeros when total weight is 0", () => {
    expect(largestRemainder([0, 0], 100)).toEqual([0, 0]);
  });
});

// ---- allocate: core + edge cases (spec §5) ----------------------------------
describe("allocate", () => {
  it("splits an item evenly and credits the payer", () => {
    const a = allocate(contributors("A", "B"), [item(1000, "c0", { c0: 1, c1: 1 })]);
    expect(owingTotals(a)).toEqual([500, 500]);
    expect(paidTotals(a)).toEqual([1000, 0]);
    expect(a.grandTotal).toBe(1000);
    expect(a.owingUnaccounted).toBe(0);
    expect(a.paidUnaccounted).toBe(0);
  });

  it("places every cent in the v1 remainder-bug case (ratios 3:4, cost 10)", () => {
    const a = allocate(contributors("A", "B"), [item(10, "c0", { c0: 3, c1: 4 })]);
    expect(sum(owingTotals(a))).toBe(10); // v1 dropped a cent here
    expect(a.owingUnaccounted).toBe(0);
    expect(owingTotals(a)).toEqual([4, 6]);
  });

  it("skips zero-cost items", () => {
    const a = allocate(contributors("A", "B"), [item(0, "c0", { c0: 1, c1: 1 })]);
    expect(a.grandTotal).toBe(0);
    expect(owingTotals(a)).toEqual([0, 0]);
  });

  it("skips items with no splits without dividing by zero", () => {
    const a = allocate(contributors("A"), [item(500, "c0", {})]);
    // cost still accrues to the payer; nobody owes it → owingUnaccounted = cost
    expect(a.grandTotal).toBe(500);
    expect(a.owingUnaccounted).toBe(500);
    expect(paidTotals(a)).toEqual([500]);
  });

  it("books a split for a missing contributor as owingUnaccounted", () => {
    const a = allocate(contributors("A"), [item(1000, "c0", { c0: 1, ghost: 1 })]);
    expect(a.contributions.get(0)!.owing.total).toBe(500);
    expect(a.owingUnaccounted).toBe(500);
  });

  it("books a missing payer as paidUnaccounted", () => {
    const a = allocate(contributors("A", "B"), [item(1000, "ghost", { c0: 1, c1: 1 })]);
    expect(a.paidUnaccounted).toBe(1000);
    expect(sum(owingTotals(a))).toBe(1000);
  });

  it("handles an empty contributor list — all unaccounted, grandTotal intact", () => {
    const a = allocate([], [item(1000, "c0", { c0: 1 })]);
    expect(a.grandTotal).toBe(1000);
    expect(a.owingUnaccounted).toBe(1000);
    expect(a.paidUnaccounted).toBe(1000);
  });

  it("a sole 100% contributor owes exactly the cost", () => {
    const a = allocate(contributors("A"), [item(999, "c0", { c0: 5 })]);
    expect(a.contributions.get(0)!.owing.total).toBe(999);
  });

  it("works for integer minor units with no fractional remainder split", () => {
    const a = allocate(contributors("A", "B", "C"), [item(1000, "c0", { c0: 1, c1: 1, c2: 1 })]);
    expect(sum(owingTotals(a))).toBe(1000);
    expect(owingTotals(a)).toEqual([334, 333, 333]);
  });

  it("keeps the human-readable split triple per owing line", () => {
    const a = allocate(contributors("A", "B"), [item(600, "c0", { c0: 1, c1: 4 })]);
    expect(a.contributions.get(1)!.owing.items[0].split).toEqual({
      numerator: 4,
      denominator: 5,
      multiplicand: 600,
    });
  });

  it("grandTotal equals the item subtotal (items are tax/tip-inclusive)", () => {
    const a = allocate(contributors("A", "B"), [item(900, "c0", { c0: 2, c1: 1 })]);
    expect(owingTotals(a)).toEqual([600, 300]);
    expect(a.grandTotal).toBe(900);
    expect(a.subtotal).toBe(900);
    expect(sum(paidTotals(a))).toBe(900); // c0 paid all → 900/0
    expect(a.owingUnaccounted).toBe(0);
  });
});

// ---- invariants over random cheques (spec §6) ---------------------------------
describe("allocate invariants (property sweep)", () => {
  // Deterministic LCG so any failure reproduces.
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  }

  it("Σowing = Σpaid = grandTotal, 0 unaccounted, balances net 0 — for valid cheques", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = rng(seed);
      const n = 1 + Math.floor(r() * 5);
      const cs = contributors(...Array.from({ length: n }, (_, i) => `name${i}`));
      const itemCount = Math.floor(r() * 6);
      const items: AllocItem[] = [];
      for (let k = 0; k < itemCount; k++) {
        const splits: Record<string, number> = {};
        for (let i = 0; i < n; i++) {
          const ratio = Math.floor(r() * 5); // some zero (excluded share), some large
          if (ratio > 0) splits[`c${i}`] = ratio;
        }
        const cost = Math.floor(r() * 100000);
        const payer = `c${Math.floor(r() * n)}`;
        if (Object.keys(splits).length > 0) items.push(item(cost, payer, splits));
      }
      const a = allocate(cs, items);

      const label = `seed ${seed}`;
      expect(a.grandTotal, label).toBe(a.subtotal);
      expect(sum(owingTotals(a)) + a.owingUnaccounted, label).toBe(a.grandTotal);
      expect(sum(paidTotals(a)) + a.paidUnaccounted, label).toBe(a.grandTotal);
      // Every split/payer references a real contributor → apportionment is exact,
      // so nothing is unaccounted.
      expect(a.owingUnaccounted, label).toBe(0);
      expect(a.paidUnaccounted, label).toBe(0);
      // balances net to zero
      const balance = sum(owingTotals(a)) - sum(paidTotals(a));
      expect(balance, label).toBe(0);
    }
  });

  it("is deterministic — identical input yields identical output", () => {
    const cs = contributors("A", "B", "C");
    const items = [item(1001, "c0", { c0: 1, c1: 1, c2: 1 }), item(777, "c1", { c0: 2, c2: 3 })];
    const a = allocate(cs, items);
    const b = allocate(cs, items);
    expect(owingTotals(a)).toEqual(owingTotals(b));
    expect(paidTotals(a)).toEqual(paidTotals(b));
  });
});
