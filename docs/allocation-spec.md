# Allocation & Settlement Spec (v2)

The domain math core: given a bill's items, who-paid, and per-item split ratios, compute (1) what each person **owes** vs **paid**, and (2) the minimal set of **"X sends Y $Z"** transfers to settle up. This is a clean redesign of the v1 logic, keeping the algorithms but fixing a penny-dropping bug, decoupling math from UI, and making money/currency first-class.

## Goals

- **Exact:** allocated owings always sum to the grand total — no dropped or phantom cents, ever.
- **Fair:** rounding remainders are distributed by a principled, deterministic rule.
- **Pure & testable:** all math lives in pure functions returning structured data; formatting and i18n happen only at the render edge.
- **Currency-agnostic:** amounts are plain decimals (integer minor units ×100, two fraction digits, no symbol). No currency code on a bill.
- **Deterministic:** identical input → identical output on every device (matters for the sync engine's convergence guarantees).

## Two algorithms

There are two distinct computations, and v1 has them in two different places:

| Algorithm               | v1 location                                                                   | What it does                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Per-item allocation** | `allocate.ts` (pure, tested)                                                  | Splits each item's cost across its contributors by ratio; produces per-person `owing` and `paid` totals + line-item breakdown. |
| **Debt settlement**     | `getAllocationStrings()` inside `EntryPayments.svelte` (impure, **untested**) | Nets each person's balance and greedily matches debtors to creditors → list of transfers.                                      |

v2 makes both pure, tested modules.

---

## 1. Money representation

- All amounts are **integer minor units** (cents). Never floats. Keep this from v1.
- Bills are **currency-agnostic**: a fixed minor-unit scale of 100 (two fraction digits) and a single shared plain-decimal formatter (no symbol). There is no per-bill currency code; the split/remainder math is pure integer arithmetic.

```ts
const AMOUNT_SCALE = 100; // minor units per whole; amounts are integer minor units
// AMOUNT_FORMATTER: Intl.NumberFormat decimal, 2 fraction digits, no currency symbol
```

---

## 2. Per-item allocation

### Inputs

- `contributors: { id, name }[]`
- `items: { id, name, cost, contributor_id /* who paid */, splits: { contributor_id, ratio }[] }[]`

### Output (per contributor, by stable index)

```ts
type Allocations = {
  contributions: Map<
    number,
    {
      owing: {
        items: { name; cost; split: { numerator; denominator; multiplicand } }[];
        total: number;
      };
      paid: { items: { name; cost }[]; total: number };
    }
  >;
  grandTotal: number;
  owingUnaccounted: number; // should always be 0 with correct data; surfaces corruption
  paidUnaccounted: number;
};
```

The `split` triple (`numerator`/`denominator`/`multiplicand`) is kept so the UI can show the human-readable calc, e.g. _"$6.00 × 1 / 5"_.

### Algorithm (per item)

1. `splitTotal = Σ ratios`. Skip the item if `cost === 0` or `splitTotal === 0`.
2. `base = floor(cost / splitTotal)`. Each contributor `i` owes `base × ratioᵢ`.
3. `remainder = cost mod splitTotal` minor units remain to be distributed (this is the rounding leftover).
4. Distribute the `remainder` cents, one at a time, by a fair rule (see below).
5. The payer (`contributor_id`) accrues the full `cost` into their `paid` bucket.
6. A split/payer whose contributor isn't found increments `owingUnaccounted` / `paidUnaccounted`.

### ⚠️ Bug in v1 remainder distribution (must fix)

v1 builds a `MaxHeap` of contributors keyed by _cumulative owing total_, then for `i in 0..remainder` does `extractMax(); value += 1` **without re-inserting**. The heap therefore holds at most one node per contributor.

When `remainder > contributorCount` (possible whenever ratios exceed 1 — i.e. `splitTotal` can far exceed the number of splits), the heap empties before all remainder cents are placed, and the leftovers fall into `owingUnaccounted`. The owing side then sums to **less** than the cost while the paid side is full → phantom "unaccounted" money and `Σowing ≠ grandTotal`.

**Reproduction:** 2 contributors, ratios `3` and `4` (`splitTotal = 7`), `cost = 10`. `base = 1` → owes `3` and `4` (sum 7). `remainder = 3`, but only 2 heap nodes: after two extractions one cent is left → dropped to `owingUnaccounted`. Owing totals `5 + 4 = 9 ≠ 10`.

### v2 fix — Largest-Remainder (Hamilton) apportionment

Replace the cumulative-total heap with the standard largest-remainder method — provably exact and fair, and trivially deterministic:

```
for each split i:
    exactᵢ      = cost * ratioᵢ / splitTotal      // rational
    baseᵢ       = floor(exactᵢ)                    // integer minor units
    remainderᵢ  = (cost * ratioᵢ) mod splitTotal   // fractional part, as integer
owingᵢ = baseᵢ
left   = cost - Σ baseᵢ                            // 0 ≤ left < number of splits
// hand out the `left` leftover cents to the splits with the largest remainderᵢ,
// breaking ties by contributor index (stable, deterministic)
for the top `left` splits by (remainderᵢ desc, index asc):
    owingᵢ += 1
```

Guarantees: `Σ owingᵢ == cost` exactly; each person is within 1 cent of their exact share; output is identical across devices. `owingUnaccounted`/`paidUnaccounted` then _only_ ever reflect genuinely missing contributors (data corruption), which is their intended purpose.

### Tax & tip — REMOVED (was a Phase-0 first-class decision)

A cheque splits **arbitrary** purchases, not a single restaurant receipt, so one global tax/tip never generalized (a cheque can mix stores/categories with different or no tax). **Line items are now entered tax/tip-inclusive** (final amounts), so there is no bill-level apportionment. `grandTotal == subtotal`. `bills.tax`/`bills.tip` are dropped. The only thing this gives up is automatic proportional tip; if it's ever wanted, add it as a _per-line-item split mode_ (e.g. "proportional to subtotal"), which is strictly more flexible than a global field. The explicit-tax/tip-payer sub-decision is moot.

---

## 3. Debt settlement

### Purpose

Turn net balances into concrete transfers: _"Alice sends Bob $12.30."_

### Net balance

For each contributor: `balance = paid.total − owing.total`. Positive = creditor (is owed money), negative = debtor (owes money). `Σ balance == 0` when allocation is exact (another reason §2's fix matters).

### v1 algorithm (greedy, keep the approach)

Two max-heaps keyed by `|balance|` — creditors in one, debtors in the other. Repeatedly take the largest debtor and largest creditor, transfer `min(debt, credit)`, decrement both, and re-heap whichever still has a residual. Each transfer zeroes at least one party, so it terminates in **≤ n−1 transfers**.

### v2 changes

- **Extract to a pure module** `settle(allocations, contributors) -> Transfer[]` where `Transfer = { fromIndex, toIndex, amount }`. The component only maps transfers → localized strings. (v1 builds locale strings _inside_ the heap loop, which is why it's untested.)
- **Deterministic tie-breaking:** when balances tie, break by contributor index so all devices produce the same transfer list.
- **Unaccounted handling:** if `owingUnaccounted`/`paidUnaccounted` are non-zero, emit explicit "X unaccounted for" transfer-like records rather than silently absorbing (as v1 does in its `else` branch).
- **Optimality note:** greedy largest-debtor/largest-creditor is _not_ guaranteed minimal (min-transactions is NP-hard). It produces ≤ n−1 and is near-optimal in practice. Keep greedy; document that "fewest possible transfers" is explicitly a non-goal. If ever desired, a subset-sum pre-pass can merge exact-offsetting groups first.

---

## 4. Account linking & payment routing (consumed by settlement UI)

The settlement view (`EntryPayments`) also drives social features that belong in the auth/invite spec but are noted here because they hang off the transfer list:

- A creditor row shows their saved **payment method** (`etransfer`/`payPal`) + **payment id** with a copy button.
- An unlinked anonymous contributor can be **linked** to the current user's account (`linkContributorAccount`) right from this view.
- The current user can edit their own payment method/id inline (`updateUserPayment`), which also updates their account defaults.

v2: keep this UI affordance, but it consumes the pure `Transfer[]` rather than recomputing balances.

---

## 5. Edge cases (all must be covered by tests)

1. Item with `cost = 0` → contributes nothing; shown "void" in UI.
2. Item with no splits / `splitTotal = 0` → skipped, not divided by zero.
3. A split referencing a deleted contributor → counts toward `owingUnaccounted`, never crashes.
4. Payer not in contributor list → `paidUnaccounted`.
5. Empty contributor list → everything unaccounted; `grandTotal` still correct (v1 test asserts this).
6. Ratios with large `splitTotal` and a remainder `> contributor count` → **§2 bug case**; must distribute every cent.
7. A single contributor owns 100% → owes exactly `cost`.
8. Everyone already even → settlement returns `[]`.
9. JPY (0-decimal) bill → no fractional cents anywhere.

---

## 6. Acceptance invariants

For any valid bill (no missing references):

- `Σ owing.total == grandTotal` and `Σ paid.total == grandTotal`.
- `grandTotal == subtotal` (items are entered tax/tip-inclusive; no bill-level tax/tip).
- `owingUnaccounted == 0 && paidUnaccounted == 0`.
- `Σ balance == 0`.
- `settle(...)` returns `≤ n−1` transfers and, when applied, zeroes every balance.
- Each person's owing is within 1 minor unit of their exact rational share for every item.
- Re-running on a second device with the same input yields byte-identical `Allocations` and `Transfer[]`.

---

## 7. Module layout for the new project

```
formatter.ts      AMOUNT_SCALE, AMOUNT_FORMATTER, getNumericDisplay()  (currency-agnostic)
lib/allocate/     allocate(contributors, items) -> Allocations   (pure)
lib/settle/       settle(allocations, contributors) -> Transfer[] (pure)
lib/heap/         MaxHeap (kept; or replace allocate's use with largest-remainder)
```

The MaxHeap stays useful for settlement; the per-item remainder step no longer needs it once largest-remainder replaces the cumulative-total heap.

---

## 8. Open decisions

- ~~Tax & tip~~ — **REMOVED.** Was first-class `bills.tax`/`bills.tip`; reversed because line items are entered tax/tip-inclusive (§ "Tax & tip — REMOVED").
- ~~Currency per item vs per bill~~ — **REMOVED.** Bills are currency-agnostic: amounts are plain decimals (minor units ×100, two fraction digits, no symbol). No `bills.currency`.
- **Settlement optimality:** confirm greedy (≤ n−1) is acceptable vs. investing in subset-sum minimization.
