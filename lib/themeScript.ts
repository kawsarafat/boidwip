/** Sets the dark/light class on <html> before the page paints, so there's no
 *  flash of the wrong theme on load, and keeps it live-synced to the OS/browser
 *  setting after that. If the person hasn't manually toggled (no explicit choice
 *  saved yet), changing the OS theme, including while the tab is already open,
 *  updates the site immediately. Once someone uses the manual toggle, that
 *  explicit choice is remembered and takes over from the automatic behavior.
 *
 *  Shared rather than inlined in the layout because app/global-not-found.tsx
 *  renders its own <html> and must run the identical script. A 404 page that
 *  skipped it would paint in the light theme for a reader whose stored choice is
 *  dark, then snap - which is the exact flash this script exists to prevent, on
 *  the one page nobody tests.
 *
 *  Injected as a PLAIN inline <script>, not next/script: `beforeInteractive`
 *  renders a real <script> element into the React tree, and React warns that a
 *  script tag rendered by a component never executes on a client render
 *  ("Encountered a script tag while rendering React component"). Covered by the
 *  'unsafe-inline' in script-src (next.config.mjs). */
export const themeInitScript = `
(function () {
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    function apply() {
      var stored = localStorage.getItem('theme');
      var isDark = stored ? stored === 'dark' : mq.matches;
      document.documentElement.classList.toggle('dark', isDark);
    }
    apply();
    mq.addEventListener('change', function () {
      if (!localStorage.getItem('theme')) apply();
    });
  } catch (e) {}
})();
`;
