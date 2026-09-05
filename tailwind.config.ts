import type { Config } from "tailwindcss";
// Imported rather than require()'d: the project is "type": "module" (Payload
// 3 is pure ESM), and `require` is not defined in an ES module.
import typography from "@tailwindcss/typography";

/** Every semantic colour is a CSS custom property holding "R G B" channels,
 *  read through this helper so Tailwind's opacity modifiers still work
 *  (`bg-surface/80`, `border-rule/60`). A plain `var(--x)` would break those
 *  silently: the class compiles, the alpha is just ignored.
 *
 *  WHY TOKENS RATHER THAN A LIGHT PALETTE PLUS `dark:` VARIANTS:
 *   1. Every element would need its colour written twice, and class strings
 *      ship on the wire — roughly half of them would be the dark duplicate.
 *   2. A missed `dark:` is invisible until someone looks in dark mode. With
 *      one token there is nothing to forget.
 *   3. The prose palette in globals.css reads the SAME variables, so the
 *      article body cannot drift from the chrome.
 *
 *  AND THE TRAP THAT COMES WITH IT: Tailwind emits nothing for a colour
 *  class it does not recognise and does not warn. `text-ink` after `ink` is
 *  removed from this file is not an error — it is invisible text in one
 *  theme only. Colours go through tokens, never raw palette classes, and a
 *  removed token gets grepped for before it is removed. */
const token = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    // The `**` covers the (frontend), (payload) and (preview) route groups;
    // Next's route groups are real directories, so a shallower pattern would
    // miss them.
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic, theme-flipping. Values live in app/(frontend)/globals.css
        // as "R G B" channel triplets under :root and .dark.
        //
        // The palette is cool near-neutral greys plus one deep-wine accent —
        // the register of a reference site rather than a craft blog. Light:
        // cool near-white canvas, pure-white cards, wine accent. Dark: a
        // slate-blue near-black, never a warm brown one.
        canvas: token("--canvas"), // page background
        surface: token("--surface"), // cards, the book panel
        "surface-sunken": token("--surface-sunken"), // tiles inside a card
        ink: token("--ink"), // body text
        "ink-muted": token("--ink-muted"), // metadata, captions
        rule: token("--rule"), // hairlines, borders
        accent: token("--accent"), // links, headings, reading mark
        "accent-soft": token("--accent-soft"), // accent backgrounds, chips
        // The foreground for anything filled with `bg-accent`. Never
        // `text-white` there: the accent is dark in light mode and light in
        // dark mode, so the text on it has to flip too. See globals.css.
        "on-accent": token("--on-accent"),

        // THE TWO RESERVED CTA COLOURS. Nothing else on the site may use
        // `buy` or `download` — after two page views a reader recognises
        // both buttons without reading them, and that recognition is worth
        // more than palette variety. Green = buy hardcopy (Rokomari),
        // blue = free PDF. Do not "reuse the nice green" anywhere.
        buy: token("--buy"),
        download: token("--download"),

        // Rights notices, stale-price fallbacks, moderation flags.
        warn: token("--warn"),
      },
      fontFamily: {
        // Single family (Anek Bangla variable), weight does the work of
        // establishing hierarchy (700/800 headings, 400/500 body). Bengali
        // has no widely-available serif that pairs well with a Latin serif
        // anyway, so one confident sans is the honest choice.
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        // A system stack, not a webfont: `font-mono` appears in almost no
        // places (TOC numerals), and downloading a family for a decorative
        // <span> is two more files racing the Bengali text LCP is measured on.
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      boxShadow: {
        // Two-layer shadows (tight contact + wide ambient) rather than one
        // blurred box — a card resting on the page instead of floating.
        //
        // Tinted with the light theme's own ink (20 26 34) rather than neutral
        // black, so the shadow shares the neutrals' cool cast instead of
        // greying against them. It stays a literal, and stays the LIGHT ink in
        // both themes: a shadow is cast by the card onto whatever is behind it,
        // and on the dark canvas that is already darker than any tint here.
        // The alphas are unchanged from the previous warm tint (27 26 23),
        // whose relative luminance this one matches to within 0.0004, so the
        // repaint changes the hue of every shadow and not its weight.
        card: "0 1px 2px rgb(20 26 34 / 0.05), 0 1px 3px rgb(20 26 34 / 0.07)",
        "card-hover": "0 4px 8px rgb(20 26 34 / 0.07), 0 12px 24px rgb(20 26 34 / 0.09)",
        pop: "0 8px 16px rgb(20 26 34 / 0.09), 0 24px 48px rgb(20 26 34 / 0.13)",
      },
      borderRadius: {
        xl2: "0.75rem",
      },
      maxWidth: {
        // The reading column. 68ch rather than a pixel width because the
        // measure that matters is characters per line, and Bengali glyphs
        // are wider than Latin ones at the same font size.
        prose: "68ch",
      },
      aspectRatio: {
        // Book covers are portrait 2:3 everywhere — cards, hero, OG source.
        // One named ratio so no component hand-types 0.666.
        cover: "2 / 3",
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // The mobile drawer. Keyframes rather than a transition between two
        // utility classes, deliberately: see components/MobileMenu.tsx. The
        // direction is baked into the keyframe so the element's resting
        // state (no animation at all) is ON screen, not translated out.
        "drawer-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "drawer-out": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
      },
      animation: {
        // Short and small on purpose. Anything longer reads as the page
        // being slow. All neutralised by the prefers-reduced-motion block in
        // globals.css, which is safe because every one uses `both`: with a
        // 0.01ms duration they snap to their end state.
        "fade-in-up": "fade-in-up 220ms ease-out both",
        "fade-in": "fade-in 160ms ease-out both",
        // Keep these two in step with TRANSITION_MS in MobileMenu.tsx.
        "drawer-in": "drawer-in 240ms ease-out both",
        "drawer-out": "drawer-out 240ms ease-in both",
        "scrim-in": "fade-in 200ms ease-out both",
        "scrim-out": "fade-in 200ms ease-in both reverse",
      },
    },
  },
  plugins: [typography],
};

export default config;
