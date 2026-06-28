<!--
  Avatar — a single round avatar: a photo when `src` is given, otherwise the
  initial on a coloured disc. Consolidates the avatar markup previously inlined in
  AccountButton + MarketingHero; the overlap/stack layout stays with the consumer.
-->
<script lang="ts">
  import { nameInitials } from "$lib/utils/common/palette";

  let {
    src = null,
    name = "",
    initial,
    color = "var(--color-action)",
    size = "2rem",
    alt = "",
    title = undefined,
  }: {
    /** Photo URL; falls back to the initial disc when null. */
    src?: string | null;
    /** Display name; used to derive `initial` and as default alt text. */
    name?: string;
    /** Override the disc label; defaults to the name's initials (kept reactive
        to `name` via $derived — a prop default would only run once). */
    initial?: string;
    /** Disc background for the initial variant. */
    color?: string;
    /** Any CSS length (rem/px). Drives both dimensions + font size. */
    size?: string;
    alt?: string;
    title?: string;
  } = $props();

  const shownInitial = $derived(initial ?? nameInitials(name));
</script>

{#if src}
  <img
    class="avatar"
    {src}
    alt={alt || name}
    {title}
    referrerpolicy="no-referrer"
    style:--avatar-size={size}
  />
{:else}
  <span
    class="avatar initial"
    style:--avatar-size={size}
    style:background-color={color}
    title={title ?? name}
    aria-hidden={alt || name ? undefined : "true"}>{shownInitial}</span>
{/if}

<style>
  .avatar {
    block-size: var(--avatar-size);
    border-radius: 50%;
    flex-shrink: 0;
    inline-size: var(--avatar-size);
    object-fit: cover;
  }
  .initial {
    align-items: center;
    color: var(--white);
    display: inline-flex;
    font-family: "JetBrains Mono", monospace;
    font-size: calc(var(--avatar-size) * 0.42);
    font-weight: 700;
    justify-content: center;
    line-height: 1;
  }
</style>
