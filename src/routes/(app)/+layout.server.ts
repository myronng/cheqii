import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies }) => {
  return {
    cookies: cookies.getAll(),
  };
};

export const ssr = false;
// The app is a client-rendered SPA, never prerendered — so the crawler reaching
// these from the prerendered landing's links skips them instead of erroring.
export const prerender = false;
