# Cheqii — marketing brief

Source-of-truth summary for building the marketing landing page. Pair with
`docs/design-tokens.json` for the visual system.

## One-liner

**Cheqii is a collaborative cost splitter — split any group purchase, together and in real time, and settle up in the fewest payments.**

Tagline in product: _"A collaborative cost splitter."_ · Sub: _"Intelligently split your group purchases using fewer transactions."_

## What it is

A fast, local-first web app (installable PWA) for splitting shared costs with a
group. Not just restaurant bills — **a "cheque" can hold anything**: a grocery
run, a trip, concert tickets, a shared household month. You list items, say who
paid and who shares each one, and Cheqii works out exactly who owes whom — then
reduces it to the minimum set of payments.

## Who it's for

Friends, roommates, couples, trip groups, teams — anyone splitting irregular
shared expenses who's tired of spreadsheets, "I'll Venmo you later," and apps
that demand everyone create an account first.

## The problem it solves

- Splitting is fiddly: unequal shares, different payers, rounding that never adds up.
- Most tools make everyone sign up before anyone can help.
- Group math produces a tangle of "everyone pays everyone" transfers.

## How it works (3 steps)

1. **Start a cheque** — instantly, as a guest (no account).
2. **Add items** — each with a cost, who paid, and who's splitting it (by share).
3. **Settle** — see each person's balance and the minimal "X pays Y $Z" transfers.

## Key features (proof points)

- **No-signup start.** Begin as an anonymous guest in one tap; upgrade to Google
  later and all your data carries over (nothing lost).
- **Real-time collaboration.** Multiple people edit the same cheque live across
  devices (sync via a conflict-free engine).
- **Works offline.** Local-first — edits are saved on-device and sync when you're
  back online; data is recoverable from the server if a device is wiped.
- **Exact, fair math.** Per-item splitting by share with largest-remainder
  rounding — every cent is placed, never dropped or invented.
- **Fewest payments.** Balances are netted into the minimal set of transfers.
- **Share a link.** Invite collaborators to a private cheque with a link, or share
  a public read-only view.
- **Know how to pay.** Each person can attach a payment handle (e-transfer / PayPal).
- **Install it.** Add to home screen; offline-capable PWA. Light & dark themes.
- **Export.** Download any cheque as CSV.

## Value props (headline candidates)

1. **Start splitting in seconds — no account, no friction.**
2. **Split anything, fairly — down to the last cent.**
3. **Settle up in the fewest payments.**
4. **Edit together, in real time — even offline.**
5. **Invite with a link; upgrade when you're ready.**

## Differentiators

- Guest-first (others gate behind signup).
- Built for _arbitrary_ group purchases, not only restaurant tabs (no global
  tax/tip assumption; items are entered as final amounts).
- Local-first + real-time: fast, offline-tolerant, multi-device.
- Minimal-transfer settlement, exact rounding.

## Brand voice & feel

Friendly, plain-spoken, a little playful; trustworthy about money. Avoid jargon.
Visually: soft sage-green "paper" with deep-teal "ink" (dark mode), brand greens
for actions, rounded shapes (16px cards, pill buttons), frosted-glass surfaces,
quick gentle motion. Display font **Comfortaa** (rounded), amounts in
**JetBrains Mono**. See `docs/design-tokens.json`.

## Primary CTA

"Start a cheque" / "New bill" → launches the app (guest, no signup). Secondary:
"Sign in with Google."

## Facts to keep accurate

- Currency-agnostic: amounts are plain decimals (no currency symbol / no per-bill currency).
- No bill-level tax/tip — items are entered tax/tip-inclusive.
- Free to start as a guest; Google sign-in optional for a durable account.
- Live app: https://cheqii.myronng5.workers.dev
