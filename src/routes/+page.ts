// The landing is server-rendered (not prerendered) so the host-canonicalization
// in hooks.server.ts runs for every request to `/` (a prerendered static `/`
// would be served before the hook, so app.cheqii.com/ → /bills couldn't redirect).
// SSR still gives crawlable HTML + fast first paint; it boots no app context.
export const prerender = false;
