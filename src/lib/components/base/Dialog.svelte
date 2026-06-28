<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { LocalizedStrings } from "$lib/utils/common/locale";
  import type { HTMLDialogAttributes } from "svelte/elements";
  import { type Snippet, onMount } from "svelte";

  import Button from "$lib/components/base/buttons/Button.svelte";
  import Cancel from "$lib/components/icons/Cancel.svelte";

  // The modal's open state is driven by the URL hash (e.g. `#settings`), so the
  // browser/Android Back button closes the modal before navigating away, and the
  // open state survives a reload / is deep-linkable. Opening pushes `#hash`;
  // every close path (X, Esc, click-outside) pops it via history.back().
  let {
    children,
    hash,
    strings,
    title,
    titleContent,
    ...props
  }: {
    hash: string;
    strings: LocalizedStrings;
    title: string;
    /** Custom title-bar content (e.g. an editable name field); falls back to `title`. */
    titleContent?: Snippet;
  } & HTMLDialogAttributes = $props();

  let dialogEl = $state<HTMLDialogElement>();
  let contentEl = $state<HTMLDivElement>();
  const isOpen = $derived(!!hash && page.url.hash === `#${hash}`);

  // If the hash is already set at first paint the modal was deep-linked/reloaded,
  // so there may be no in-app history entry to pop — the first close strips the
  // hash in place instead of risking a Back that leaves the app.
  let deepLinked = $state(false);
  onMount(() => {
    deepLinked = !!hash && page.url.hash === `#${hash}`;
  });

  $effect(() => {
    if (!dialogEl) return;
    if (isOpen && !dialogEl.open) {
      dialogEl.showModal();
      // showModal() auto-focuses the first focusable child (e.g. an editable
      // title field). Move focus to the body instead so opening the modal never
      // starts editing — callers that want a field focused do it explicitly.
      contentEl?.focus();
    } else if (!isOpen && dialogEl.open) {
      dialogEl.close();
    }
  });

  function close() {
    if (page.url.hash !== `#${hash}`) return;
    if (deepLinked) {
      deepLinked = false;
      void goto(`${page.url.pathname}${page.url.search}`, { replaceState: true, noScroll: true });
    } else {
      history.back();
    }
  }
</script>

{#snippet icon()}
  <Cancel variant="button" />
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialogEl}
  oncancel={(e) => {
    // Esc: intercept the native close so the hash stays in sync (close() pops it).
    e.preventDefault();
    close();
  }}
  onclick={(e) => {
    // Click-outside (desktop): a click whose target is the <dialog> itself landed
    // on the backdrop, not the content. On mobile the content fills the viewport,
    // so this never fires there.
    if (e.target === dialogEl) close();
  }}
  {...props}
>
  <div bind:this={contentEl} class="content" tabindex="-1">
    <h1 class="title">
      {#if titleContent}
        {@render titleContent()}
      {:else}
        <span>{title}</span>
      {/if}
      <Button borderless {icon} onclick={close} title={strings["close"]} />
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
            var(--color-background-raised) 4.01px
          )
          top left,
        linear-gradient(
            45deg,
            var(--color-background-raised) 2px,
            transparent 2.01px
          )
          top left,
        linear-gradient(
            135deg,
            var(--color-background-raised) 2px,
            transparent 2.01px
          )
          bottom left,
        linear-gradient(
            45deg,
            transparent 4px,
            var(--color-background-raised) 4.01px
          )
          bottom left;
      background-size: 6px 3px;
      background-repeat: repeat-x;
      block-size: calc(100vh - calc(var(--space-2) * 0.5));
      inline-size: 100vw;
      margin: calc(var(--space-2) * 0.5) 0 0 0;
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
            var(--color-background-raised) 4.01px
          )
          top left,
        linear-gradient(
            45deg,
            var(--color-background-raised) 2px,
            transparent 2.01px
          )
          top left,
        linear-gradient(
            135deg,
            var(--color-background-raised) 2px,
            transparent 2.01px
          )
          bottom left,
        linear-gradient(
            45deg,
            transparent 4px,
            var(--color-background-raised) 4.01px
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
      background-color: var(--color-backdrop);
    }
  }

  .content {
    background-color: var(--color-background-raised);
    min-block-size: 100%;
    /* Focused programmatically on open (focus management) — no ring on the box. */
    outline: none;
    overflow-x: auto;
  }

  .title {
    align-items: center;
    border-block-end: var(--border-divider) solid var(--color-border);
    display: flex;
    gap: var(--space-2);
    justify-content: space-between;
    padding: var(--space-2);
  }
</style>
