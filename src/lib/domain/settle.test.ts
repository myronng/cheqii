import { describe, expect, it } from "vitest";
import { type AllocContributor, type AllocItem, allocate } from "./allocate";
import { type Transfer, settle } from "./settle";

function contributors(n: number): AllocContributor[] {
  return Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `name${i}` }));
}
function item(cost: number, payer: string, splits: Record<string, number>): AllocItem {
  return {
    id: `i-${cost}-${payer}`,
    name: "x",
    cost,
    contributor_id: payer,
    splits: Object.entries(splits).map(([contributor_id, ratio]) => ({ contributor_id, ratio })),
  };
}

/** Apply transfers to the net balances and return the residual per contributor. */
function applyTransfers(balances: number[], transfers: Transfer[]): number[] {
  const out = balances.slice();
  for (const t of transfers) {
    out[t.fromIndex] += t.amount; // debtor pays down what they owe
    out[t.toIndex] -= t.amount; // creditor receives what they're owed
  }
  return out;
}
function balancesOf(a: ReturnType<typeof allocate>): number[] {
  return [...a.contributions.values()].map((c) => c.paid.total - c.owing.total);
}

describe("settle", () => {
  it("settles a simple two-person debt in one transfer", () => {
    // c0 paid 1000, both owe 500 → c1 owes c0 500
    const a = allocate(contributors(2), [item(1000, "c0", { c0: 1, c1: 1 })]);
    const { transfers } = settle(a);
    expect(transfers).toEqual([{ fromIndex: 1, toIndex: 0, amount: 500 }]);
  });

  it("returns no transfers when everyone is already even", () => {
    // each pays their own equal share
    const a = allocate(contributors(2), [item(500, "c0", { c0: 1 }), item(500, "c1", { c1: 1 })]);
    expect(settle(a).transfers).toEqual([]);
  });

  it("zeroes every balance in ≤ n−1 transfers for random valid bills", () => {
    function rng(seed: number) {
      let s = seed >>> 0;
      return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    }
    for (let seed = 1; seed <= 150; seed++) {
      const r = rng(seed);
      const n = 2 + Math.floor(r() * 5);
      const cs = contributors(n);
      const items: AllocItem[] = [];
      const k = 1 + Math.floor(r() * 6);
      for (let j = 0; j < k; j++) {
        const splits: Record<string, number> = {};
        for (let i = 0; i < n; i++) {
          const ratio = Math.floor(r() * 4);
          if (ratio > 0) splits[`c${i}`] = ratio;
        }
        if (Object.keys(splits).length === 0) splits[`c0`] = 1;
        items.push(item(Math.floor(r() * 50000), `c${Math.floor(r() * n)}`, splits));
      }
      const a = allocate(cs, items);

      const balances = balancesOf(a);
      const { transfers } = settle(a);
      const label = `seed ${seed}`;

      expect(transfers.length, label).toBeLessThanOrEqual(n - 1);
      expect(
        transfers.every((t) => t.amount > 0),
        label,
      ).toBe(true);
      // applying the transfers settles everyone to zero
      expect(
        applyTransfers(balances, transfers).every((b) => b === 0),
        label,
      ).toBe(true);
    }
  });

  it("is deterministic, breaking ties by index", () => {
    // c0 and c1 each owe 100 to a shared creditor pattern; tie must resolve by index
    const a = allocate(contributors(3), [
      item(300, "c2", { c0: 1, c1: 1, c2: 1 }), // c2 paid; c0,c1 each owe 100
    ]);
    const first = settle(a).transfers;
    const second = settle(a).transfers;
    expect(first).toEqual(second);
    // both debtors (c0,c1) pay creditor c2; lower index debtor listed first
    expect(first[0].fromIndex).toBeLessThan(first[1].fromIndex);
    expect(first.every((t) => t.toIndex === 2)).toBe(true);
  });

  it("passes through unaccounted amounts rather than absorbing them", () => {
    const a = allocate(contributors(1), [item(1000, "ghost", { c0: 1 })]);
    const s = settle(a);
    expect(s.paidUnaccounted).toBe(1000);
  });
});
