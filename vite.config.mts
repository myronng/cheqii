import { defineConfig } from "vite-plus";
import { sveltekit } from "@sveltejs/kit/vite";
import devtoolsJson from "vite-plugin-devtools-json";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  build: {
    target: "es2022",
  },
  plugins: [sveltekit(), devtoolsJson()],
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
    environment: "happy-dom",
  },
  resolve: {
    conditions: ["browser"],
  },
});
