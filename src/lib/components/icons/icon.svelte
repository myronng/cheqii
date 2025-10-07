<script lang="ts">
  import type { SVGAttributes } from "svelte/elements";

  let {
    children,
    variant,
    ...props
  }: {
    variant?: "adaptive" | "button" | "fullButton" | "normal";
  } & SVGAttributes<SVGElement> = $props();

  const classes: string[] = [];
  if (variant && variant !== "normal") {
    classes.push(variant);
  }
</script>

<svg
  class={classes.join(" ")}
  viewBox="0 0 24 24"
  xmlns="http://www.w3.org/2000/svg"
  {...props}
>
  {@render children?.()}
</svg>

<style>
  svg {
    block-size: 1em;
    color: currentColor;
    fill: none;
    inline-size: 1em;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2.5;
  }

  @media screen and (max-width: 768px) {
    .adaptive {
      font-size: 32px;
      stroke-width: 1.5;
    }
  }

  .button {
    font-size: 32px;
    stroke-width: 1.5;
  }

  .fullButton {
    font-size: 48px;
    stroke-width: 1;
  }
</style>
