<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";

  let {
    children,
    color,
    padding = 1,
    ...props
  }: {
    color?: "default" | "error";
    padding?: number;
  } & HTMLButtonAttributes = $props();

  const classes: string[] = [];

  if (color === "error") {
    classes.push("error");
  }
</script>

<button class={classes.join(" ")} style:--padding={padding} {...props}>
  {@render children?.()}
</button>

<style>
  button {
    align-items: center;
    background-color: transparent;
    block-size: auto;
    border: 0;
    box-sizing: border-box;
    font: inherit;
    font-family: Comfortaa;
    font-weight: 700;
    gap: calc(var(--length-spacing) * 2 * var(--padding));
    min-block-size: 0;
    overflow: hidden;
    padding-block: calc(var(--length-spacing) * var(--padding));
    padding-inline: calc(var(--length-spacing) * 2 * var(--padding));
    text-align: start;

    @media (prefers-reduced-motion: no-preference) {
      transition:
        ease background-color 75ms,
        block-size 75ms,
        display 75ms allow-discrete,
        padding-block 75ms;

      @starting-style {
        block-size: 0;
        padding-block: 0;
      }
    }

    &:disabled {
      color: var(--color-font-disabled);
      pointer-events: none;
    }

    &:not(:disabled) {
      cursor: pointer;

      &:active {
        background-color: var(--color-background-active);
      }

      &:hover:not(:active) {
        background-color: var(--color-background-hover);
      }

      &:not(.error) {
        color: var(--color-primary);
      }

      &.error {
        color: var(--color-error);
      }
    }

    &:not([hidden]) {
      display: flex;
    }

    &[hidden] {
      block-size: 0;
      padding-block: 0;
    }
  }
</style>
