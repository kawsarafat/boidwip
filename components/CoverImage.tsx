import Image from "next/image";
import { DEFAULT_COVER_IMAGE } from "@/lib/types";

/** A book cover.
 *
 *  ALT TEXT IS A DECISION THE CALLER OWNS, because whether this image carries
 *  information depends entirely on what surrounds it:
 *
 *  - Inside a link that already contains the book's title (BookCard, the
 *    sidebar's popular list), the cover is decoration. Naming the book again
 *    makes a screen reader read the same title twice per card. `alt=""` — the
 *    default — is correct there.
 *  - When the image is the ONLY content of a link (the cover thumbnails on a
 *    curated list page), that link has no accessible name at all with an empty
 *    alt, which is a WCAG 2.4.4 failure and is read out as the bare URL. There
 *    the fix belongs on the LINK (aria-label), not here, so it holds even when
 *    the book has no cover and the placeholder renders.
 *  - On a book's own page the cover is the artwork of the subject rather than
 *    decoration, so it gets a real description.
 *
 *  Hence an `alt` prop that defaults to decorative and is spelled out at the
 *  two call sites where the image has to speak for itself.
 *
 *  next/image intentionally won't optimize arbitrary SVG sources (they can
 *  contain scripts) unless you opt in globally, which isn't worth doing just for
 *  one trusted local asset. The default cover is already a tiny vector file with
 *  nothing to optimize, so it's served as a plain <img>; every real uploaded
 *  photo still goes through next/image as normal. */
export default function CoverImage({
  src,
  className,
  sizes,
  fill = true,
  priority = false,
  alt = "",
}: {
  src: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
  priority?: boolean;
  /** Leave unset when adjacent text already names the book. */
  alt?: string;
}) {
  // Both branches honour `alt`. A missing cover does not make a caller's need
  // for a description go away — and where a link's accessible name is at stake
  // the caller labels the LINK (see the list page), so this never has to
  // apologise for a placeholder in words.
  if (src === DEFAULT_COVER_IMAGE) {
    return (
      // This one source is a local SVG placeholder, and next/image refuses to
      // optimize SVG without a global opt-in that would apply to every uploaded
      // file on the site. The directive has to be the LAST line before the
      // element: "next-line" means the literal next line, so a continuation of
      // this note sitting under it suppressed nothing and reported itself as an
      // unused disable.
      // eslint-disable-next-line @next/next/no-img-element -- see above
      <img
        src={src}
        alt={alt}
        // h-full w-full stands in for next/image's `fill`, which this branch
        // does not have. object-fit is NOT set here: every caller already passes
        // `object-cover` (the Image branch below gives them no choice, since it
        // sets no fit of its own), so hardcoding it too rendered the literal
        // class list `object-cover object-cover …`. Leaving it to the caller in
        // both branches also means a caller who forgets it is wrong on every
        // book rather than only on the ones with an uploaded cover.
        className={`h-full w-full ${className ?? ""}`}
        loading={priority ? "eager" : "lazy"}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      className={className}
      priority={priority}
    />
  );
}
