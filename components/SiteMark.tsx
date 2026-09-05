/** The বইদ্বীপ mark: an open book whose pages rise into an island hill with
 *  the sun behind it — "boi" (book) + "dwip" (island) in one shape.
 *
 *  The geometry is the same as public/icon.svg, which is the favicon, the
 *  manifest icon and the Organization logo in the sitewide JSON-LD. They are
 *  two files rather than one because that one has to be a standalone document
 *  a browser can request, while this one has to be inline SVG to inherit the
 *  page's size and to render inside a link. Change one, change the other: a
 *  favicon that does not match the header is worse than either mark alone.
 *
 *  WHY `id` IS A REQUIRED PROP
 *
 *  The tile is a gradient, so the SVG needs a <linearGradient> with an id, and
 *  `url(#...)` resolves against the whole document. Three of these render on
 *  one page (header, footer, drawer), so a single hardcoded id would put the
 *  same id in the DOM three times. It would still LOOK right, because the
 *  browser picks the first match and all three are identical — which is
 *  exactly why this is worth making impossible rather than leaving to be
 *  noticed later. A required prop means a new call site cannot forget.
 *
 *  Colours are literal hex, unlike everything else in the site's components.
 *  That is deliberate and is the one place it applies: this is a logo, not
 *  themed UI. It has to be the same wine-to-oxblood tile on a cool near-white
 *  page, on a slate near-black page, and in a browser tab beside twenty other
 *  favicons, so reading it from the theme tokens would mean the brand changing
 *  colour with the theme.
 *
 *  THE CREAM STAYS CREAM. The tile follows the accent (it is the same wine, so
 *  the mark and the site's links belong to one palette), but the sun, the island
 *  and the pages do NOT follow the neutrals into cool grey: wine-and-cream is a
 *  bookbinding pairing and cool grey pages would make the open book read as a
 *  laptop. A logo is allowed to be warmer than the UI around it. */
export default function SiteMark({
  className,
  id,
}: {
  className?: string;
  /** Unique within the page, e.g. "header". See the note above. */
  id: string;
}) {
  const gradientId = `boidwip-mark-${id}`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      // The wordmark next to every instance already names the site, and each
      // link carries its own aria-label, so announcing this too would repeat it.
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A82A46" />
          <stop offset=".55" stopColor="#93233B" />
          <stop offset="1" stopColor="#7A1B30" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="14" fill={`url(#${gradientId})`} />

      {/* The sun, low behind the island — cream, so it reads on the tile. */}
      <circle cx="32" cy="26" r="9" fill="#F6C453" />

      {/* The island hill: a soft mound rising out of the book below. Its base
          overlaps the pages so the two shapes read as one scene. */}
      <path
        d="M15 38c5-8 11-12 17-12s12 4 17 12v3H15v-3z"
        fill="#F1E7D8"
        opacity=".95"
      />

      {/* The open book: two page-spreads meeting at a centre spine. Drawn
          last so its top edge crops the hill — the island STANDS ON the book. */}
      <path
        d="M32 40c-4.5-3.4-10.5-4.6-17-4.2V50c6.5-.4 12.5.8 17 4.2V40z"
        fill="#FFFDF8"
      />
      <path
        d="M32 40c4.5-3.4 10.5-4.6 17-4.2V50c-6.5-.4-12.5.8-17 4.2V40z"
        fill="#F6EFE3"
      />
      {/* Text lines on the pages — a book in use, not a blank one. */}
      <path d="M19 42.5c3.4-.1 6.6.3 9.5 1.3M19 46.5c3.4-.1 6.6.3 9.5 1.3" stroke="#C9A87C" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M45 42.5c-3.4-.1-6.6.3-9.5 1.3M45 46.5c-3.4-.1-6.6.3-9.5 1.3" stroke="#C9A87C" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
