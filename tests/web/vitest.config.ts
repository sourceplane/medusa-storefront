import { defineConfig } from "vitest/config";
import * as path from "node:path";

const web = path.resolve(__dirname, "../../apps/web");
const src = path.join(web, "src");

export default defineConfig({
  resolve: {
    // The storefront's own path aliases (apps/web/tsconfig.json).
    alias: {
      // The storefront's own Next.js, so the tests' mocks of `next/headers`,
      // `next/cache` and `next/navigation` are the modules its code imports
      // (pnpm installs a copy per peer set).
      next: path.join(web, "node_modules/next"),
      "@lib": path.join(src, "lib"),
      "@modules": path.join(src, "modules"),
      "@app-src": src,
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
