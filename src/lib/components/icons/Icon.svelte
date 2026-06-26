<script lang="ts">
  import type { Component } from "svelte";
  import type { SVGAttributes } from "svelte/elements";

  // Shared wrapper for Tabler outline icons (design-system spec §4, Option A).
  // The icon itself is an `unplugin-icons` component (`~icons/tabler/<name>`),
  // which already ships 1em sizing, currentColor, fill:none and stroke-width 2.
  // This wrapper only applies the size/stroke `variant` class (styles are global
  // in app.css since they target the generated <svg>).
  let {
    icon: IconComponent,
    variant,
    ...props
  }: {
    icon: Component<SVGAttributes<SVGElement>>;
    variant?: "adaptive" | "button" | "fullButton" | "normal";
  } & SVGAttributes<SVGElement> = $props();

  const className = $derived(
    ["icon", variant && variant !== "normal" ? variant : ""].filter(Boolean).join(" "),
  );
</script>

<IconComponent class={className} {...props} />
