<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  import { parseNumericFormat } from "$lib/utils/common/formatter";
  let {
    alignment,
    fit = false,
    formatter,
    isAlternate,
    onblur,
    onchange,
    onfocus,
    value = "",
    ...props
  }: {
    alignment?: "end" | "start";
    /** Size the field to its content instead of filling its container (cards).
        The grid relies on the default 100% fill of its min-content columns. */
    fit?: boolean;
    formatter?: Intl.NumberFormat;
    isAlternate?: boolean;
  } & HTMLInputAttributes = $props();

  const min = $derived(Number(props.min));
  const max = $derived(Number(props.max));

  // Content-based width (also the min so the field never collapses below it).
  const widthCalc = $derived(
    value
      ? `calc(${value.toString().length}ch + (var(--space-2) * 2))`
      : `calc(${(props.placeholder ?? "").toString().length}ch + (var(--space-2) * 2))`,
  );
</script>

<input
  onblur={(e) => {
    if (formatter) {
      e.currentTarget.value = formatter.format(
        parseNumericFormat(formatter, e.currentTarget.value, min, max),
      );
    }
    onblur?.(e);
  }}
  onchange={(e) => {
    if (formatter) {
      const newValue = parseNumericFormat(
        formatter,
        e.currentTarget.value,
        min,
        max,
      );
      e.currentTarget.value = newValue.toString();
    }
    onchange?.(e);
  }}
  onfocus={(e) => {
    const target = e.currentTarget;
    if (formatter) {
      e.currentTarget.value = parseNumericFormat(
        formatter,
        target.value,
        min,
        max,
      ).toString();
    }
    onfocus?.(e);
    requestAnimationFrame(() => {
      target.select();
    });
  }}
  style:--color-background-raised={isAlternate ? undefined : "transparent"}
  style:color={formatter &&
  parseNumericFormat(formatter, value.toString(), min, max) === 0
    ? "var(--color-text-inactive)"
    : "currentColor"}
  style:min-inline-size={widthCalc}
  style:inline-size={fit ? widthCalc : undefined}
  style:text-align={formatter || alignment === "end" ? "end" : "start"}
  {value}
  {...props}
/>

<style>
  input {
    background-color: var(--color-background-raised);
    border: none;
    flex-basis: 0;
    font: inherit;
    inline-size: 100%;
    outline-offset: calc(var(--border-divider) * -1);
    padding-block: calc(var(--space-2) * 0.5);
    padding-inline: var(--space-2);

    @media (prefers-reduced-motion: no-preference) {
      transition: ease background-color 75ms;
    }

    &:hover:not(:focus-within) {
      background-color: var(--color-surface-hover);
    }

    &:focus-within {
      background-color: var(--color-surface-active);
      outline: var(--border-divider) solid var(--color-action);

      &::placeholder {
        color: var(--color-text-muted);
      }
    }

    &::placeholder {
      color: currentColor;
    }
  }
</style>
