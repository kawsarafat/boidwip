import type { BookContent } from "@/lib/types";

/** The provenance footnote: where a book's text came from, and why it is legal
 *  for this site to be serving it.
 *
 *  WHY THIS IS A COMPONENT AND NOT THREE COPIES OF A <p>
 *
 *  Three pages serve the same text — the book page, the chapter reader, and the
 *  reader's contents page — and a citation that appears on one of them is not a
 *  citation, it is an inconsistency. Google's spam policy on Scraping is about
 *  republishing "without adding any original content or value, or even citing
 *  the original source"; the page a searcher actually lands on is whichever one
 *  ranked, so all three have to carry it. One component, three call sites, no
 *  way to update the wording in one place and forget the others.
 *
 *  WHAT IT DELIBERATELY DOES NOT SAY
 *
 *  Nothing from `rightsBasis` or the permission evidence. Those are the site's
 *  own legal reasoning and a third party's personal data respectively, both
 *  read-restricted in collections/Books.ts, and neither becomes publishable by
 *  being reworded. What a reader is owed is the source and the term arithmetic,
 *  which is exactly what is here.
 *
 *  Renders nothing at all when there is nothing to say, rather than an empty
 *  bordered box: a Tier D book has no source to cite, and a heading over
 *  nothing is worse than no heading. */
export default function TextSourceNote({
  book,
  includeLicence = false,
  className = "",
}: {
  book: Pick<
    BookContent,
    "rightsTier" | "textSourceName" | "textSourceUrl" | "publicDomainNote" | "licenceName" | "licenceUrl"
  >;
  /** Name the licence here too. True on the reader pages, where nothing else
   *  does; false on the book page, where the header already carries it beside
   *  the download control that triggered the obligation. */
  includeLicence?: boolean;
  className?: string;
}) {
  const showLicence =
    includeLicence && book.rightsTier === "open-licence" && Boolean(book.licenceName);
  if (!book.textSourceName && !book.publicDomainNote && !showLicence) return null;

  return (
    <aside
      aria-label="টেক্সট ও স্বত্ব"
      className={`rounded-xl2 border border-rule bg-surface-sunken px-4 py-3 text-xs leading-relaxed text-ink-muted sm:px-5 ${className}`}
    >
      {/* A <p>, not an <h3>. Three different templates mount this, each with its
          own heading outline, and the pages are audited for "no heading-level
          jumps" — a fixed heading level cannot satisfy all three, and a real
          heading would also need an id to be labelled by, which duplicates the
          moment anything renders this twice. aria-label carries the same name to
          assistive tech without either problem. */}
      <p className="text-[0.7rem] font-bold uppercase tracking-wide">টেক্সট ও স্বত্ব</p>

      {book.textSourceName && (
        <p className="mt-1.5">
          টেক্সট সূত্র:{" "}
          {book.textSourceUrl ? (
            <a
              href={book.textSourceUrl}
              // Not `sponsored`: this is a citation of our source, the one link
              // on the page that is supposed to pass credit rather than withhold
              // it. `nofollow` here would be the machine-readable version of
              // refusing to attribute.
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline hover:text-accent"
            >
              {book.textSourceName}
            </a>
          ) : (
            <span className="font-medium">{book.textSourceName}</span>
          )}
        </p>
      )}

      {book.publicDomainNote && <p className="mt-1.5">{book.publicDomainNote}</p>}

      {showLicence && (
        <p className="mt-1.5">
          লাইসেন্স:{" "}
          {book.licenceUrl ? (
            <a
              href={book.licenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline hover:text-accent"
            >
              {book.licenceName}
            </a>
          ) : (
            <span className="font-medium">{book.licenceName}</span>
          )}
        </p>
      )}
    </aside>
  );
}
