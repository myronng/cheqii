<script lang="ts">
  import type { LocalizedStrings } from "$lib/utils/common/locale";
  import type { HTMLDialogAttributes } from "svelte/elements";

  import Button from "$lib/components/base/buttons/Button.svelte";
  import Cancel from "$lib/components/icons/Cancel.svelte";

  let {
    children,
    id,
    strings,
    title,
    ...props
  }: { strings: LocalizedStrings; title: string } & HTMLDialogAttributes =
    $props();
</script>

{#snippet icon()}
  <Cancel variant="button" />
{/snippet}

<dialog {id} {...props}>
  <div class="content">
    <h1 class="title">
      <span>{title}</span>
      <Button
        borderless
        {icon}
        onclick={(e) => {
          e.currentTarget.closest("dialog")?.close();
        }}
        title={strings["close"]}
      />
    </h1>
    {@render children?.()}
  </div>
</dialog>

<style>
  @media screen and (max-width: 768px) {
    dialog {
      background:
        linear-gradient(
            135deg,
            transparent 4px,
            var(--color-background-secondary) 4.01px
          )
          top left,
        linear-gradient(
            45deg,
            var(--color-background-secondary) 2px,
            transparent 2.01px
          )
          top left,
        linear-gradient(
            135deg,
            var(--color-background-secondary) 2px,
            transparent 2.01px
          )
          bottom left,
        linear-gradient(
            45deg,
            transparent 4px,
            var(--color-background-secondary) 4.01px
          )
          bottom left;
      background-size: 6px 3px;
      background-repeat: repeat-x;
      block-size: calc(100vh - calc(var(--length-spacing) * 0.5));
      inline-size: 100vw;
      margin: calc(var(--length-spacing) * 0.5) 0 0 0;
      max-block-size: unset;
      max-inline-size: unset;
      padding: 3px 0 0 0;

      .content {
        inline-size: 100%;
      }
    }
  }

  @media screen and (min-width: 769px) {
    dialog {
      background:
        linear-gradient(
            135deg,
            transparent 4px,
            var(--color-background-secondary) 4.01px
          )
          top left,
        linear-gradient(
            45deg,
            var(--color-background-secondary) 2px,
            transparent 2.01px
          )
          top left,
        linear-gradient(
            135deg,
            var(--color-background-secondary) 2px,
            transparent 2.01px
          )
          bottom left,
        linear-gradient(
            45deg,
            transparent 4px,
            var(--color-background-secondary) 4.01px
          )
          bottom left;
      background-size: 6px 3px;
      background-repeat: repeat-x;
      bottom: 0;
      left: 0;
      margin: auto;
      padding: 3px 0;
      right: 0;
      top: 0;
    }

    .content {
      inline-size: fit-content;
    }
  }

  dialog {
    border: 0;
    color: currentColor;

    @media (prefers-reduced-motion: no-preference) {
      transition:
        ease transform 225ms,
        display 225ms allow-discrete;

      @starting-style {
        transform: translateY(100vh);
      }

      &:not([open]) {
        transform: translateY(100vh);
      }
    }

    &::backdrop {
      background-color: var(--color-background-backdrop);
    }
  }

  .content {
    background-color: var(--color-background-secondary);
    min-block-size: 100%;
    overflow-x: auto;
  }

  .title {
    align-items: center;
    border-block-end: var(--length-divider) solid var(--color-divider);
    display: flex;
    gap: var(--length-spacing);
    justify-content: space-between;
    padding: var(--length-spacing);
  }
</style>
