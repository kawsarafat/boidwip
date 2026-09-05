import Link from "next/link";
import type { Metric } from "./queries";
import styles from "./Dashboard.module.css";

/** One big number, and the list it came from.
 *
 *  THE WHOLE CARD IS THE LINK, not a "view all" affordance in the corner: the
 *  number is the only thing on it anyone wants to act on, and a 200px card with
 *  a 60px hit area is the kind of detail that makes a panel feel unfinished on a
 *  laptop trackpad.
 *
 *  A server component with no `use client`, like everything else in this folder.
 *  A stat card has no state, and shipping four of them to the browser as
 *  interactive components would add JavaScript to render text that never
 *  changes. */
export default function StatCard({ metric }: { metric: Metric }) {
  const { count, hint, href, label, tone } = metric;

  return (
    <Link className={styles.statCard} data-tone={tone} href={href} prefetch={false}>
      <span className={styles.statFigure}>
        {/* An em dash, not a zero: the count could not be read, and zero would
            be a claim about the catalogue rather than about the query. */}
        {count === null ? "—" : count.toLocaleString("en-US")}
      </span>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statHint}>{count === null ? "Could not be read." : hint}</span>
    </Link>
  );
}
