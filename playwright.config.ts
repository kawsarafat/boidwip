import { defineConfig, devices } from "@playwright/test";

/** Smoke tests against a REAL production build.
 *
 *  Not `next dev`: half of what these tests assert only exists in a production
 *  build — the prerendered HTML, the sitemap, the canonical tags, and the fact
 *  that a route which should have been statically generated actually was. A dev
 *  server renders everything on demand and would happily pass a suite that a
 *  deploy then fails.
 *
 *  So `webServer` runs `next start`, which requires `next build` to have run
 *  first (CI does exactly that; locally, run `npm run build` once). It is NOT
 *  wired to run the build itself, because a 2-minute build hidden inside a test
 *  command is how you end up with a suite nobody runs.
 *
 *  127.0.0.1 rather than localhost: on a machine that resolves localhost to ::1
 *  first, the readiness probe can hit a port nothing is listening on while the
 *  server sits happily on IPv4. */
const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // A .only left in a spec is a silent loss of coverage on main.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    // The site is Bengali; a browser advertising bn-BD is the honest client.
    locale: "bn-BD",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      // API and SEO specs assert properties of a response, not of a viewport.
      // Running them a second time on the phone project would double the
      // requests, double the review submissions, and prove nothing new.
      testIgnore: /\.mobile\.spec\.ts$/,
    },
    // The audit's mobile findings (tap targets, the drawer, the reader's
    // prev/next grid) are only observable at a phone viewport, so they get a
    // real project rather than a page.setViewportSize call inside one spec.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /\.mobile\.spec\.ts$/,
    },
  ],
  // Reused locally so a watch loop does not fight for the port; never reused in
  // CI, where a stale server would mean testing the previous commit.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
