import { defineConfig } from "vite-plus";
import { sveltekit } from "@sveltejs/kit/vite";
import devtoolsJson from "vite-plugin-devtools-json";
import Icons from "unplugin-icons/vite";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  build: {
    target: "es2022",
  },
  plugins: [
    sveltekit(),
    devtoolsJson(),
    // Tabler OUTLINE icons compiled per-import → tree-shaken by construction
    // (design-system spec §4, Phase-0 Option A). `~icons/tabler/<name>` only
    // bundles icons actually imported; never the @tabler/icons-svelte barrel.
    // The shared Icon.svelte wrapper applies the `icon`/variant class (see app.css).
    Icons({ compiler: "svelte" }),
  ],
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
    environment: "happy-dom",
  },
  resolve: {
    conditions: ["browser"],
  },
});
