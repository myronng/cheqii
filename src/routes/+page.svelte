<script lang="ts">
  import MarketingHero from "$lib/components/marketing/MarketingHero.svelte";
  import { DEFAULT_LOCALE, LOCALE_MASTER } from "$lib/utils/common/locale";

  // Single-locale, prerendered: resolve copy from the locale master at build.
  const strings = LOCALE_MASTER[DEFAULT_LOCALE];
</script>

<svelte:head>
  <title>{strings["appName"]} — {strings["landingHeadline"]}</title>
  <meta name="description" content={strings["landingMetaDescription"]} />
</svelte:head>

<MarketingHero {strings} />
