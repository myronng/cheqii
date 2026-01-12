import { getLocaleStrings } from "$lib/utils/common/locale";

export async function GET({ cookies, request }) {
  const { locale, strings } = getLocaleStrings(cookies, request, [
    "appDescription",
    "appName",
  ]);
  const manifest = {
    background_color: "#304D4E",
    description: strings["appDescription"],
    display: "standalone",
    display_override: ["window-controls-overlay", "minimal-ui"],
    icons: [
      {
        src: "/logos/icon_512.png",
        sizes: "512x512",
        type: "image/png",
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
