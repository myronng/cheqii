import { getLocaleStrings } from "$lib/utils/common/locale";

export async function GET({ cookies, request }) {
  const { locale, strings } = getLocaleStrings(cookies, request, [
    "appDescription",
    "appName",
    "screenshotEditorWide",
    "screenshotEditorNarrow",
    "screenshotSettleNarrow",
  ]);
  const manifest = {
    background_color: "#304D4E",
    categories: ["finance", "productivity", "utilities"],
    description: strings["appDescription"],
    display: "standalone",
    display_override: ["window-controls-overlay", "minimal-ui"],
    icons: [
      {
        src: "/logos/icon_192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logos/icon_512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logos/icon_maskable.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    id: "/",
    lang: locale,
    name: strings["appName"],
    orientation: "natural",
    // Rich install UI: with screenshots (+ description), Chrome upgrades the
    // Android prompt to a store-style bottom sheet and the desktop dialog shows
    // previews. narrow = phone sheet, wide = desktop dialog.
    screenshots: [
      {
        src: "/screenshots/narrow-editor.png",
        sizes: "430x934",
        type: "image/png",
        form_factor: "narrow",
        label: strings["screenshotEditorNarrow"],
      },
      {
        src: "/screenshots/narrow-settle.png",
        sizes: "430x934",
        type: "image/png",
        form_factor: "narrow",
        label: strings["screenshotSettleNarrow"],
      },
      {
        src: "/screenshots/wide-editor.png",
        sizes: "1923x1080",
        type: "image/png",
        form_factor: "wide",
        label: strings["screenshotEditorWide"],
      },
    ],
    short_name: strings["appName"],
    start_url: "/",
    theme_color: "#304D4E",
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
    },
  });
}
