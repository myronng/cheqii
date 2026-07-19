<script lang="ts">
  import type { LocalizedStrings } from "$lib/utils/common/locale";

  import Button from "$lib/components/base/buttons/Button.svelte";
  import Share from "$lib/components/icons/Share.svelte";

  let {
    strings,
    title,
    url,
  }: { strings: LocalizedStrings; title: string; url: string } = $props();
</script>

{#snippet icon()}
  <Share variant="button" />
{/snippet}

<Button
  borderless
  {icon}
  onclick={async () => {
    // Prefer the native share sheet (mobile/PWA), degrade to copying the link.
    // NOTE: canShare() must be called WITH the data — an argument-less canShare()
    // returns false on every browser, which used to skip the sheet entirely.
    const data = { title, url };
    if (navigator.share && (navigator.canShare?.(data) ?? true)) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        // User dismissed the sheet → not an error; anything else falls back to copy.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
  }}
  title={strings["share"]}
/>
