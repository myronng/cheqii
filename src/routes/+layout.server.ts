import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies }) => {
  return {
    cookies: cookies.getAll(),
  };
};

export const ssr = false;
