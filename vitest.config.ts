import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests only — pure functions, no database, no browser.
 *
 *  `include` is narrowed to tests/unit deliberately: tests/e2e holds Playwright
 *  specs, which import @playwright/test and would be collected (and then fail
 *  to run) if Vitest were allowed to glob the whole tree.
 *
 *  The `@` alias mirrors the `paths` entry in tsconfig.json. Vitest does not
 *  read tsconfig paths on its own, and without this every `@/lib/...` import
 *  fails to resolve. Resolved with path.dirname rather than `new URL("./")` so
 *  there is no trailing separator to double up on Windows. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
