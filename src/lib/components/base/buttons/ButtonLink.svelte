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

  const classes = $derived.by(() => {
    const list: string[] = [];
    if (borderless) {
      list.push("borderless");
    }

    if (color === "error") {
      list.push("error");
    }

    if (icon) {
      list.push("icon");

      if (!children) {
        list.push("only");
      }
    }
    return list;
  });
</script>

<a class={classes.join(" ")} style:--padding={padding} {...props}>
  {@render icon?.()}
  {@render children?.()}
</a>

<style>
  a {
    align-items: center;
    background-color: transparent;
    color: var(--color-action);
    display: flex;
    font: inherit;
    font-family: Comfortaa;
    font-weight: 700;
    gap: var(--space-2);
    justify-content: center;
    text-decoration: none;

    @media screen and (max-width: 768px) {
      &.icon {
        border: 0;
        border-radius: 50%;
        font-size: 32px;
        padding: calc(var(--space-2) * var(--padding));
      }
    }

    @media screen and (min-width: 769px) {
      &.icon {
        &:not(.borderless) {
          border-style: solid;
          border-width: var(--border-divider);
        }

        &.borderless {
          border: 0;
        }

        &:not(.only) {
          border-radius: 100vw;
          padding-block: calc(var(--space-2) * var(--padding));
          padding-inline: calc(var(--space-2) * 2 * var(--padding));
        }

        &.only {
          border-radius: 50%;
          padding: calc(var(--space-2) * var(--padding));
        }
      }
    }

    @media (prefers-reduced-motion: no-preference) {
      transition:
        ease background-color 75ms,
        border-color 75ms;
    }

    &:disabled {
      border-color: var(--color-border);
      color: var(--color-text-muted);
      pointer-events: none;
    }

    &:not(:disabled) {
      border-color: var(--color-action);
      cursor: pointer;

      &:active {
        background-color: var(--color-surface-active);
      }

      &:hover:not(:active) {
        background-color: var(--color-surface-hover);
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
      padding-block: calc(var(--space-2) * var(--padding));
      padding-inline: calc(var(--space-2) * 2 * var(--padding));

      &:not(.borderless) {
        border-style: solid;
        border-width: var(--border-divider);
      }

      &.borderless {
        border: 0;
      }
    }
  }
</style>
