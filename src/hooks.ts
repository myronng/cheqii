import type { Reroute } from "@sveltejs/kit";

// One Worker serves both cheqii.com (marketing) and app.cheqii.com (the app), so
// "/" can't be a single page. On the app host the cheque list IS the home page:
// render the /cheques route at "/" without changing the URL. The apex host keeps
// "/" as the marketing landing. (Locally the app lives at /cheques and marketing
// at /, since there's no host to disambiguate.)
export const reroute: Reroute = ({ url }) => {
  if (url.hostname === "app.cheqii.com" && url.pathname === "/") return "/cheques";
};
