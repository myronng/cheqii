<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";

  let {
    borderless = false,
    children,
    color,
    icon,
    padding = 1,
    ...props
  }: {
    borderless?: boolean;
    color?: "default" | "error";
    icon?: Snippet;
    padding?: number;
  } & HTMLAnchorAttributes = $props();

  const classes: string[] = [];
  if (borderless) {
    classes.push("borderless");
  }

  if (color === "error") {
    classes.push("error");
  }

  if (icon) {
    classes.push("icon");

    if (!children) {
      classes.push("only");
    }
  }
</script>

<a class={classes.join(" ")} style:--padding={padding} {...props}>
  {@render icon?.()}
  {@render children?.()}
</a>

<style>
  a {
    align-items: center;
    background-color: transparent;
    color: var(--color-primary);
    display: flex;
    font: inherit;
    font-family: Comfortaa;
    font-weight: 700;
    gap: var(--length-spacing);
    justify-content: center;
    text-decoration: none;

    @media screen and (max-width: 768px) {
      &.icon {
        border: 0;
        border-radius: 50%;
        font-size: 32px;
        padding: calc(var(--length-spacing) * var(--padding));
      }
    }

    @media screen and (min-width: 769px) {
      &.icon {
        &:not(.borderless) {
          border-style: solid;
          border-width: var(--length-divider);
        }

        &.borderless {
          border: 0;
        }

        &:not(.only) {
          border-radius: 100vw;
          padding-block: calc(var(--length-spacing) * var(--padding));
          padding-inline: calc(var(--length-spacing) * 2 * var(--padding));
        }

        &.only {
          border-radius: 50%;
          padding: calc(var(--length-spacing) * var(--padding));
        }
      }
    }

    @media (prefers-reduced-motion: no-preference) {
      transition:
        ease background-color 75ms,
        border-color 75ms;
    }

    &:disabled {
      border-color: var(--color-divider);
      color: var(--color-font-disabled);
      pointer-events: none;
    }

    &:not(:disabled) {
      border-color: var(--color-primary);
      cursor: pointer;

      &:active {
        background-color: var(--color-background-active);
      }

      &:hover:not(:active) {
        background-color: var(--color-background-hover);
      }

      &.error {
        color: var(--color-error);

        &:not(.borderless) {
          border-color: var(--color-error);
        }
      }
    }

    &:not(.icon) {
      border-radius: 100vw;
      padding-block: calc(var(--length-spacing) * var(--padding));
      padding-inline: calc(var(--length-spacing) * 2 * var(--padding));

      &:not(.borderless) {
        border-style: solid;
        border-width: var(--length-divider);
      }

      &.borderless {
        border: 0;
      }
    }
  }
</style>
