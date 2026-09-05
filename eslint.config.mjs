import next from "eslint-config-next/core-web-vitals";

/** ESLint 9 flat config.
 *
 *  This file exists because `next lint` was REMOVED in Next 16, and
 *  `"lint": "next lint"` in package.json had been failing since the upgrade —
 *  silently, in the sense that nobody runs a lint script that has never once
 *  reported anything and CI did not exist to run it either. The whole point of
 *  the CI workflow added alongside this file is that a broken check now fails
 *  loudly instead of passing vacuously.
 *
 *  `eslint-config-next/core-web-vitals` already contains the base `next` and
 *  `next/typescript` configs plus the Core Web Vitals rules — four config
 *  objects against the base export's three — so importing both would apply
 *  every rule twice. */

/** The `@typescript-eslint` plugin instance, taken from the Next config object
 *  that registers it. See the note on the override block below. */
const tsPlugins = next.find((c) => c.name === "next/typescript")?.plugins ?? {};

const config = [
  {
    // Generated output and generated source. `payload-types.ts` and
    // `importMap.js` are rewritten by `payload generate:*`, so a lint error in
    // either is not something a human can fix in place — it would come straight
    // back on the next generate.
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "payload-types.ts",
      "app/(payload)/admin/importMap.js",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...next,
  {
    // Flat config scopes plugins PER CONFIG OBJECT: naming a
    // "@typescript-eslint/..." rule in an object that does not itself register
    // the plugin is a hard error ("could not find plugin"), even though the
    // spread above registers it two objects earlier. So the plugin instance is
    // borrowed from the config that owns it rather than imported from a
    // transitive dependency of eslint-config-next.
    files: ["**/*.ts", "**/*.tsx"],
    plugins: tsPlugins,
    rules: {
      // Payload collections and Next route handlers are full of shapes that are
      // genuinely `any` at the boundary (hook args, JSON-LD graphs, SQL rows).
      // Warn so they stay visible; do not fail a build over them.
      "@typescript-eslint/no-explicit-any": "warn",
      // The codebase deliberately marks intentionally-unused catch bindings and
      // hook parameters with a leading underscore.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Payload writes these. `payload migrate:create` emits both hook signatures
    // in full — `({ db, payload, req })` — whether or not a given migration
    // touches payload or req, so the unused-args error here is an error about
    // a code generator, and deleting the arguments by hand would be undone by
    // the next generate. Everything else still applies to them.
    files: ["migrations/**/*.ts"],
    rules: { "@typescript-eslint/no-unused-vars": "off" },
  },
];

export default config;
