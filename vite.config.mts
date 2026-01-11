import { sveltekit } from "@sveltejs/kit/vite";
import devtoolsJson from "vite-plugin-devtools-json";

export default {
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
};
