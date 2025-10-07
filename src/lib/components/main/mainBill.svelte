<script lang="ts">
  import type { HTMLAnchorAttributes } from "svelte/elements";

  let {
    alternate,
    children,
    ...props
  }: { alternate: boolean } & HTMLAnchorAttributes = $props();

  const classes: string[] = [];
  if (alternate) {
    classes.push("alternate");
  }
</script>

<a class={classes.join(" ")} {...props}>
  {@render children?.()}
</a>

<style>
  a {
    align-items: center;
    background-color: transparent;
    border: 0;
    box-sizing: border-box;
    color: var(--color-primary);
    display: grid;
    font: inherit;
    font-family: Comfortaa;
    font-weight: 700;
    gap: calc(var(--length-spacing) * 2);
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    padding: calc(var(--length-spacing) * 2);
    text-align: start;
    text-decoration: none;

    @media (prefers-reduced-motion: no-preference) {
      transition: ease background-color 75ms;
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
    }

    &.alternate {
      background-color: var(--color-background-secondary);
    }
  }
</style>
