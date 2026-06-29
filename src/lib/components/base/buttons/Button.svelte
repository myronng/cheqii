<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  let {
    block = false,
    borderless = false,
    children,
    color,
    icon,
    padding = 1,
    variant,
    ...props
  }: {
    /** Stretch to the container's full width (e.g. a mobile CTA). */
    block?: boolean;
    borderless?: boolean;
    color?: "default" | "error" | "warning";
    icon?: Snippet;
    padding?: number;
    // Emphasis used by ActionBar: "primary" is a filled action, "secondary" the
    // default outline. Omitted = the existing outline/borderless behavior.
    variant?: "primary" | "secondary";
  } & HTMLButtonAttributes = $props();

  const classes = $derived.by(() => {
    const list: string[] = [];
    if (borderless) {
      list.push("borderless");
    }
    if (color === "error") {
      list.push("error");
    }
    if (color === "warning") {
      list.push("warning");
    }
    if (variant === "primary") {
      list.push("primary");
    }
    if (block) {
      list.push("block");
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

<button class={classes.join(" ")} style:--padding={padding} {...props}>
  {@render icon?.()}
  {@render children?.()}
</button>

<style>
  button {
    align-items: center;
    background-color: transparent;
    color: var(--color-action);
    display: flex;
    font: inherit;
    font-family: Comfortaa;
    font-weight: 700;
    gap: var(--space-2);
    justify-content: center;
    /* Size to content. Without this, a button (itself a flex container) placed in
       a flex column collapses to min-content, wrapping its label onto overlapping
       lines and squeezing the icon to zero width. */
    width: fit-content;

    /* Opt-in full-width (mobile CTAs). More specific than the base rule above. */
    &.block {
      width: 100%;
    }

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

      &.warning {
        color: var(--color-warning);

        &:not(.borderless) {
          border-color: var(--color-warning);
        }
      }

      /* Filled emphasis for the inline-end progression action (ActionBar). */
      &.primary {
        background-color: var(--color-action);
        /* No visible edge: a same-coloured border just became a darker ring once
           hover lightened the fill. Transparent (not removed) keeps the box the
           same height as outline siblings in an ActionBar. */
        border-color: transparent;
        color: var(--white);

        &:active {
          background-color: var(--color-action-active);
        }

        &:hover:not(:active) {
          background-color: var(--color-action-hover);
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
