/** Renamed from postcss.config.js to .mjs when the project moved to
 *  "type": "module" in package.json — Payload 3 and its packages are pure
 *  ESM, so the whole project has to be. A plain .js file here would now be
 *  parsed as ESM and `module.exports` would throw. */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
