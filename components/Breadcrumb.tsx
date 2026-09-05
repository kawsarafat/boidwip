import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="ব্রেডক্রাম্ব" className="mb-5 text-sm text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {item.href ? (
              <Link href={item.href} className="transition hover:text-accent">
                {item.label}
              </Link>
            ) : (
              // The current page is not a link. Marked with aria-current so it
              // is announced as the position, not read as another destination.
              //
              // Truncated rather than wrapped: the last crumb is a chapter
              // title, which is repeated verbatim as the h1 immediately below.
              // Letting it wrap to two lines pushes that h1 further down the
              // first mobile viewport to say the same thing twice. Screen
              // readers still get the full string.
              <span
                aria-current="page"
                className="block max-w-[18rem] truncate font-medium text-ink"
              >
                {item.label}
              </span>
            )}
            {i < items.length - 1 && (
              <span aria-hidden className="text-ink-muted/50">
                /
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
