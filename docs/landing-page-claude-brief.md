# Cheqii — landing page brief (for Claude)

Single self-contained brief to design/build the Cheqii marketing landing page:
product summary + the design-token system. (Source of truth: extracted from the
app's `src/app.css` and current behavior.)

---

## 1. Product

### One-liner

**Cheqii is a collaborative cost splitter — split any group purchase, together and in real time, and settle up in the fewest payments.**

Tagline in product: _"A collaborative cost splitter."_ · Sub: _"Intelligently split your group purchases using fewer transactions."_

### What it is

A fast, local-first web app (installable PWA) for splitting shared costs with a
group. Not just restaurant bills — **a "cheque" can hold anything**: a grocery
run, a trip, concert tickets, a shared household month. You list items, say who
paid and who shares each one, and Cheqii works out exactly who owes whom — then
reduces it to the minimum set of payments.

### Who it's for

Friends, roommates, couples, trip groups, teams — anyone splitting irregular
shared expenses who's tired of spreadsheets, "I'll Venmo you later," and apps
that demand everyone create an account first.

### The problem it solves

- Splitting is fiddly: unequal shares, different payers, rounding that never adds up.
- Most tools make everyone sign up before anyone can help.
- Group math produces a tangle of "everyone pays everyone" transfers.

### How it works (3 steps)

1. **Start a cheque** — instantly, as a guest (no account).
2. **Add items** — each with a cost, who paid, and who's splitting it (by share).
3. **Settle** — see each person's balance and the minimal "X pays Y $Z" transfers.

### Key features (proof points)

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

### Value props (headline candidates)

1. **Start splitting in seconds — no account, no friction.**
2. **Split anything, fairly — down to the last cent.**
3. **Settle up in the fewest payments.**
4. **Edit together, in real time — even offline.**
5. **Invite with a link; upgrade when you're ready.**

### Differentiators

- Guest-first (others gate behind signup).
- Built for _arbitrary_ group purchases, not only restaurant tabs (no global
  tax/tip assumption; items are entered as final amounts).
- Local-first + real-time: fast, offline-tolerant, multi-device.
- Minimal-transfer settlement, exact rounding.

### Brand voice & feel

Friendly, plain-spoken, a little playful; trustworthy about money. Avoid jargon.
Visually: soft sage-green "paper" with deep-teal "ink" (dark mode), brand greens
for actions, rounded shapes (16px cards, pill buttons), frosted-glass surfaces,
quick gentle motion. Display font **Comfortaa** (rounded), amounts in
**JetBrains Mono**.

### Primary CTA

"Start a cheque" / "New bill" → launches the app (guest, no signup). Secondary:
"Sign in with Google."

### Facts to keep accurate

- Currency-agnostic: amounts are plain decimals (no currency symbol / no per-bill currency).
- No bill-level tax/tip — items are entered tax/tip-inclusive.
- Free to start as a guest; Google sign-in optional for a durable account.
- Live app: https://cheqii.myronng5.workers.dev

---

## 2. Design tokens

Extracted from `src/app.css`. The app uses CSS `light-dark()` for semantic colors;
below they're **resolved into explicit light + dark values** so they're directly
usable. Primitive values are theme-independent. Maps cleanly to CSS variables or a
Tailwind theme.

```json
{
  "brand": {
    "green": "#529471",
    "greenBright": "#83CC61",
    "ink": "#304D4E",
    "inkRaised": "#385455",
    "paper": "#E5F1E3",
    "paperRaised": "#DCE8DA",
    "red": "#EE2E24",
    "black": "#000000",
    "white": "#FFFFFF"
  },
  "color": {
    "light": {
      "text": "#304D4E",
      "textMuted": "rgba(0,0,0,0.38)",
      "textInactive": "rgba(0,0,0,0.19)",
      "background": "#E5F1E3",
      "backgroundRaised": "#DCE8DA",
      "surface": "rgba(0,0,0,0.08)",
      "surfaceHover": "rgba(0,0,0,0.08)",
      "surfaceActive": "rgba(0,0,0,0.12)",
      "border": "rgba(0,0,0,0.10)",
      "borderStrong": "#000000",
      "action": "#529471",
      "actionSecondary": "#83CC61",
      "error": "#EE2E24",
      "backdrop": "rgba(0,0,0,0.36)"
    },
    "dark": {
      "text": "#E5F1E3",
      "textMuted": "rgba(255,255,255,0.50)",
      "textInactive": "rgba(255,255,255,0.25)",
      "background": "#304D4E",
      "backgroundRaised": "#385455",
      "surface": "rgba(255,255,255,0.08)",
      "surfaceHover": "rgba(255,255,255,0.08)",
      "surfaceActive": "rgba(255,255,255,0.24)",
      "border": "rgba(255,255,255,0.10)",
      "borderStrong": "#FFFFFF",
      "action": "#83CC61",
      "actionSecondary": "#529471",
      "error": "#EE2E24",
      "backdrop": "rgba(0,0,0,0.36)"
    }
  },
  "typography": {
    "fontFamilyDisplay": "Comfortaa, sans-serif",
    "fontFamilyMono": "\"JetBrains Mono\", monospace",
    "notes": "Comfortaa (rounded geometric sans) for all UI/headings/buttons; buttons use weight 700. JetBrains Mono for monetary amounts, tables, and the per-person summaries.",
    "rootFontSize": "clamp(1rem, 0.357vw + 0.821rem, 1.25rem)  /* fluid 16px -> 20px */",
    "scale": {
      "sm": "0.833rem",
      "base": "1rem",
      "lg": "1.2rem",
      "xl": "1.44rem",
      "2xl": "1.728rem",
      "ratio": "~1.2 (minor third)"
    }
  },
  "spacing": {
    "base": "8px",
    "0": "2px",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "24px",
    "6": "32px"
  },
  "shape": {
    "radiusCard": "16px",
    "borderDivider": "2px",
    "pill": "100vw  /* fully-rounded buttons */"
  },
  "effects": {
    "surfaceBlur": "64px  /* frosted-glass surfaces over the paper/ink background */"
  },
  "motion": {
    "durationFast": "75ms",
    "durationBase": "200ms",
    "easeStandard": "cubic-bezier(0.2, 0, 0, 1)"
  },
  "iconography": {
    "set": "Tabler (outline)",
    "style": "currentColor stroke, fill none, round caps, stroke-width 2 (1.5 at button size)",
    "sizes": { "inline": "1em", "button": "32px", "large": "48px" }
  },
  "feel": "Soft, friendly, rounded. Muted sage-green 'paper' background with deep teal 'ink' for dark mode; brand greens for actions. Frosted-glass raised surfaces, generous rounding (16px cards, pill buttons), quick (75-200ms) easing. Light/dark via OS preference with a manual override."
}
```
