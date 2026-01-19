---
trigger: always_on
---

# CSS Variable Enforcement Rules

Always use the CSS variables defined in [app.css](file:///home/myron/Documents/cheqii/src/app.css) for all styling. Do not use hardcoded hex, rgb, or hsl values if a corresponding variable exists.

## 1. Color Palette

- **Primary Colors**: Use `--color-primary` and `--color-secondary`.
- **Backgrounds**:
  - Main page: `--color-background-primary`
  - Overlays/Cards: `--color-background-secondary` or `--color-background-surface`
  - Backdrops: `--color-background-backdrop`
  - Interactive states: `--color-background-hover` and `--color-background-active`
- **Typography**:
  - Standard text: `--color-font-primary`
  - Inactive/Secondary text: `--color-font-inactive`
  - Disabled text: `--color-font-disabled`
- **Borders & Dividers**: Use `--color-divider` and `--color-divider-hover`.
- **Errors**: Use `--color-error`.

## 2. Layout & Spacing

- **Spacing**: Use multiples of `--length-spacing` (e.g., `gap: var(--length-spacing)`, `padding: calc(var(--length-spacing) * 2)`).
- **Border Radius**: Use `--length-radius` for containers and buttons.
- **Lines**: Use `--length-divider` for border widths or divider heights.

## 3. Visual Effects

- **Blur**: When creating blurs, use `--length-surface-blur` for `backdrop-filter: blur()`.
- **Theming**: Always ensure styles support both light and dark modes by relying on the variables which are automatically toggled via the `[data-theme="dark"]` selector in `app.css`.

## 4. Typography

- Use `font-family: "Comfortaa"` for the main application and `"JetBrains Mono"` for code or tabular data where applicable.

---

### Example Usage

```css
.my-component {
  background-color: var(--color-background-secondary);
  padding: calc(var(--length-spacing) * 2);
  border-radius: var(--length-radius);
  border: var(--length-divider) solid var(--color-divider);
  backdrop-filter: blur(var(--length-surface-blur));
}
```
