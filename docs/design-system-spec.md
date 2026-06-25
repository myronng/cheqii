# Design System Spec (v2)

A global, token-driven design system so we stop hand-rolling one-off styles that don't cohere. **We are not building from scratch** — `src/app.css` already has a working light/dark token theme and `Icon.svelte` already implements a Tabler-style outline icon. This spec promotes that seed into a documented system, fills its gaps, migrates icons to Tabler (outline, tree-shaken), and bakes in bidirectional/localized layout.

Realizes implementation-plan principles **P4** (native HTML+CSS first) and **P6** (DRY/reuse). The **logo is explicitly out of scope and unchanged.**

## Goals

- **One source of visual truth:** every color, space, radius, font, duration is a CSS custom property; components reference tokens, never literals.
- **Coherence by default:** a new screen composes existing tokens + primitives; bespoke CSS is the exception.
- **Native + least-power:** the system is plain CSS custom properties + native elements (no CSS-in-JS, no utility framework).
- **Bidi- and locale-ready:** layout mirrors automatically for RTL via logical properties + `dir`; "progression" actions always sit on the inline-end.
- **Tree-shaken icons:** only icons actually used ship to the client; all use the Tabler **outline** variant for consistency.

---

## 1. Starting point (what `app.css` already gives us)

| Layer        | Present today                                                                                                                                                                       | Notes                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Color        | `--color-{primary,secondary,error}`, `--color-background-{primary,secondary,surface,active,hover,backdrop}`, `--color-font-{primary,disabled,inactive}`, `--color-divider{,-hover}` | Light + `[data-theme="dark"]`. Dark swaps primary↔secondary. Surfaces are alpha overlays + `--length-surface-blur` (glassmorphism). |
| Space        | `--length-spacing` (8px), multiplied inline (`* 2`, `* 0.5`)                                                                                                                        | Single base unit; no named scale.                                                                                                   |
| Shape        | `--length-radius` (16px), `--length-divider` (2px)                                                                                                                                  |                                                                                                                                     |
| Type         | `Comfortaa` (display/body), `JetBrains Mono` (numerics); fluid root `clamp(1rem, …, 1.25rem)`                                                                                       | Self-hosted woff2/ttf. No scale tokens.                                                                                             |
| Theme switch | `[data-theme="dark"]` attribute                                                                                                                                                     | No `prefers-color-scheme` auto-default.                                                                                             |
| Icons        | `Icon.svelte`: `0 0 24 24`, `fill:none`, `stroke:currentColor`, round caps, `1em` sizing, stroke-width 2.5 + size variants                                                          | Already outline/Tabler-shaped.                                                                                                      |

## 2. Gaps to close

1. **No type scale** — sizes are ad hoc (26px `h1`, 32/48px icon font-sizes). Need named steps.
2. **No spacing scale** — only one unit multiplied inline; formalize a small named ramp.
3. **No motion tokens** — `Button` hardcodes `75ms`; centralize durations/easings (still under `prefers-reduced-motion`).
4. **Theme is manual-attribute only** — no `prefers-color-scheme` default; first paint can't honor OS preference without JS.
5. **Color naming mixes role and brand** — `--color-primary` is both brand and action; add a thin semantic layer (text/surface/action/feedback).
6. **No bidi story** — physical assumptions exist; no `dir`/logical-property guarantee; no directional-action convention.
7. **Icons are bespoke per-file** — fine, but migrating to Tabler needs a tree-shaking-safe delivery method.

---

## 3. v2 token architecture

Two tiers, both plain CSS custom properties on `:root`:

- **Primitive tokens** — raw values: `--green-500`, `--space-2`, `--font-mono`, `--dur-fast`.
- **Semantic tokens** — role aliases that components consume: `--color-action`, `--color-text`, `--color-surface`, `--radius-card`, `--space-inline`. Theme switching reassigns _semantic_ tokens; primitives stay constant.

### 3.1 Color

- Keep the existing palette/values; reorganize into primitive → semantic. Semantic roles: `text`, `text-muted` (was font-disabled/inactive), `surface`, `surface-raised`, `background`, `border`, `action` (was primary), `action-secondary`, `feedback-error`.
- **Theming:** default to `light-dark()` driven by `prefers-color-scheme`, with `[data-theme]` (`light`/`dark`) as an explicit override on `<html>`. Set `color-scheme` so native controls (`<select>`, scrollbars, form UI — P4) theme correctly. This makes OS-preference correct on first paint without JS.

### 3.2 Spacing & sizing

- Named ramp built on the 8px base: `--space-0` … `--space-6` (e.g. 2,4,8,12,16,24,32). Components use names, not arithmetic; this preserves the existing rhythm while killing inline `* 2.5`-style magic numbers.
- Touch targets ≥ 44px; reuse the existing responsive icon-button sizing.

### 3.3 Typography

- Font tokens `--font-display` (Comfortaa), `--font-mono` (JetBrains Mono). Keep mono for all monetary/tabular figures — it's a deliberate, correct choice for a bill app.
- A modest **type scale** (`--text-sm/base/lg/xl/2xl`) keeping the fluid root; map `h1`…`h3`, body, caption to scale steps.
- `font-display: swap` on `@font-face`; preload the two woff2.

### 3.4 Motion

- Tokens `--dur-fast` (75ms, matches current), `--dur-base`, `--ease-standard`. All transitions gated by `@media (prefers-reduced-motion: no-preference)` (already the pattern in `Button`).
- Use the **View Transitions API** for route/state changes (frontend spec) — degrades to no-op where unsupported.

### 3.5 Elevation / surfaces

- Tokenize the glassmorphism: `--surface-blur` (was `--length-surface-blur`) + the alpha-overlay surface colors. One `.surface` utility/primitive instead of repeating `backdrop-filter: blur(...)` + bg per component (it recurs in `EntrySummary`, `EntryPayments`).

---

## 4. Iconography — Tabler outline migration

**Requirement:** replace bespoke icons with **Tabler, outline variant only**, with guaranteed tree-shaking. Keep `Icon.svelte` as the shared wrapper (sizing, `currentColor`, stroke config) — only the path data changes.

### ⚠️ Avoid `@tabler/icons-svelte` direct imports

The all-in-one `@tabler/icons-svelte` package is known to **defeat tree-shaking and balloon dev/build times** (it pulls the whole set through barrel files). Do not `import { IconSettings } from "@tabler/icons-svelte"`. This is the trap to avoid.

### Two delivery options (pick in Phase 0)

**Option A — `unplugin-icons` + `@iconify-json/tabler` (recommended).**

- Build-time Vite plugin compiles **only the icons you import** into inline SVG components — perfect tree-shaking by construction, zero runtime library.
- Select the outline set by prefix (`~icons/tabler/settings`), guaranteeing variant consistency.
- Integrates with the Vite Plus stack as a normal Vite plugin.
- Cost: one build dependency and a touch of import "magic" (mild tension with **P1**'s explicitness preference — but it's build-time and deterministic, not runtime behavior).

**Option B — inline Tabler outline path data through `Icon.svelte` (most explicit).**

- Keep the current per-icon `.svelte` files; paste the **outline** `<path>` data from Tabler into each. Tree-shaking is automatic (only imported components bundle), zero deps, fully explicit (**P1/P4**).
- Cost: manual copy per icon — but the app uses only ~25–30 icons, so this is a one-afternoon task and the inventory rarely grows.

**Recommendation:** **Option A** for DX and to make adding icons frictionless; fall back to **B** if we want zero build-time magic. Either way, normalize stroke width to Tabler's outline default (`2`, vs the current `2.5`) and keep the `1em` + `currentColor` contract so icons inherit text color/size and theme automatically.

### Consistency rules

- Outline variant **only**; never mix filled/outline.
- Icons are decorative by default (`aria-hidden`); icon-only buttons require an accessible label (ties to the button system below).
- The **logo is not an icon** — it stays in `Logo.svelte`, untouched.

---

## 5. Directional & bidirectional layout

Drives the "progression button" UX and proper localization. **All achieved with native CSS logical properties + the `dir` attribute — no JS, no per-language branches** (P4).

### 5.1 `dir` + `lang` are the switch

- Set `<html lang>` and `<html dir>` from the resolved locale (a `locale → direction` map; en-CA → `ltr`). Everything below keys off `dir`, so adding an RTL locale needs **zero component changes**.
- Audit all CSS for physical properties → logical: `left/right` → `inset-inline-start/end`, `margin-left` → `margin-inline-start`, `text-align: right` → `text-align: end`, `padding-inline` (already used in `Button`). This is mostly done; finish it.

### 5.2 Progression-button convention

- **Forward/primary actions** (`Next`, `Continue`, `Submit`, `Save`) always sit on the **inline-end**; **back/secondary** (`Back`, `Cancel`) on the **inline-start**. Because these are _logical_ sides, LTR puts primary on the right and RTL on the left **automatically**.
- Implementation: a shared **action bar** primitive — `display:flex; justify-content:flex-end; gap:var(--space-…)`; the back/secondary button gets `margin-inline-end:auto` to push it to the inline-start. `flex-end` and `margin-inline` are direction-aware, so the bar mirrors under `dir="rtl"` with no extra code.
- **DOM order = reading order** (`[Back, Next]`) for tab/AT order; visual placement is purely layout. Codify this in the action-bar primitive so every dialog/wizard footer is consistent.

### 5.3 Icons & direction

- Directional icons (chevrons/arrows for next/back) must mirror in RTL — either use logical icon swaps or `:dir(rtl) { transform: scaleX(-1) }` on directional glyphs. Non-directional icons never mirror.

---

## 6. Component contracts (shared primitives)

Consolidate `base/*` so screens compose primitives instead of restyling (P6). Each is a thin wrapper over a native element (P4):

| Primitive   | Native base                      | Notes                                                                                                                                                   |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`    | `<button>`                       | Keep current variants (borderless/error/icon/only/padding); add a `variant="primary\|secondary"` that the **action bar** uses for placement + emphasis. |
| `ActionBar` | `<div>`/`<footer>`               | §5.2 logical action layout; slots for primary/secondary. Used by every dialog/wizard.                                                                   |
| `Dialog`    | `<dialog>`                       | Already native; standard header + `ActionBar` footer.                                                                                                   |
| `Popover`   | Popover API                      | New shared primitive for menus/tooltips (frontend spec §4).                                                                                             |
| `Field`     | `<label>` + `<input>`/`<select>` | Wraps native form controls + Constraint Validation styling (`:user-invalid`); one source for field look.                                                |
| `Icon`      | inline `<svg>`                   | Tabler outline via §4; unchanged contract (`1em`, `currentColor`).                                                                                      |
| `Surface`   | `<div>`                          | Tokenized glass surface (§3.5).                                                                                                                         |

Components consume **semantic tokens only**. A lint/review rule: no raw color/length literals in component `<style>` blocks (except inside the token definitions themselves).

---

## 7. Localization support (beyond strings)

The string system exists (`localeStrings.json`, `interpolateString`, subset loading); proper i18n also needs:

- **`dir`/`lang` wiring** (§5.1) and logical CSS throughout (§5).
- **Locale-aware `Intl`** for number/currency/date — already partly present; route everything through the shared `lib/money`/formatter (P6), currency from bill data (allocation/data-model specs).
- **Pluralization/ordinals** via `Intl.PluralRules` instead of naive `{count}` interpolation — `interpolateString` should grow a plural-aware path before a second locale lands.
- **No concatenation of translated fragments**; full templated strings with named `{placeholders}` (already the pattern).
- **CI guard:** fail the build if any shipped locale has a missing key (the `@key@` sentinel must never reach production).
- Even with only `en-CA` today, these guarantees are cheap now and expensive to retrofit later.

---

## 8. Acceptance scenarios

1. **Token-only components:** no component `<style>` contains a raw hex/rgb or px spacing literal; all reference tokens.
2. **OS theme on first paint:** with no explicit `data-theme`, a dark-mode OS renders dark immediately (no flash), and native `<select>`/scrollbars match.
3. **RTL mirrors with zero code change:** setting `dir="rtl"` flips the entire layout, and `Next`/`Back` swap sides correctly.
4. **Progression placement:** in every dialog/wizard footer the forward action is inline-end, back is inline-start, in both directions; DOM/tab order stays `[Back, Next]`.
5. **Icons tree-shake:** a production bundle includes only the icons actually imported; all are Tabler outline; build time is unaffected by the size of the Tabler set.
6. **Logo untouched:** `Logo.svelte` is byte-identical to v1.
7. **Reduced motion:** with `prefers-reduced-motion: reduce`, transitions/view-transitions are suppressed.
8. **Missing-string guard:** CI fails if a locale key is absent.

---

## 9. Open decisions

- **Icon delivery:** Option A (`unplugin-icons` + `@iconify-json/tabler`) vs Option B (inline outline paths via `Icon.svelte`). _Recommend A._
- **Theme strategy:** `light-dark()` + `prefers-color-scheme` default with `data-theme` override (recommended) vs keep attribute-only.
- **Stroke width:** ~~adopt Tabler's `2` default vs keep the current heavier `2.5`~~ — **RESOLVED: `2`** (Tabler outline default, for fidelity). Update `Icon.svelte` from `2.5` → `2`.
- **i18n engine:** keep JSON + `interpolateString` (+ `Intl.PluralRules`) vs adopt Paraglide/inlang once locales multiply (also raised in the frontend spec).
- **Spacing scale size:** how many named steps (4–6 is plenty for this app).
