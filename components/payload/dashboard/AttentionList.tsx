import Link from "next/link";
import type { Metric } from "./queries";
import styles from "./Dashboard.module.css";

/** The "needs attention" band: every check that can produce work, in the order
 *  the work matters, each one a link to exactly the rows it counted.
 *
 *  WHY THE ZEROES STAY ON SCREEN. Hiding a check that passes would make the list
 *  shorter, and it would also make it impossible to tell "nothing is waiting"
 *  from "that check is gone". A dashboard whose contents change shape every time
 *  you fix something cannot be learned; this one always has the same seven rows
 *  in the same order, and a row either has a number or a tick. Then the shape of
 *  the list is memorable and only the ticks move.
 *
 *  A satisfied row is still a link, deliberately: "no book is missing a cover"
 *  is exactly the claim you want to be able to check.
 *
 *  Rows whose count could not be read (a failed query, or a collection this user
 *  may not read) are dropped rather than shown as an em dash — an unreadable
 *  check is not a finding, and in the one band whose whole job is "what needs
 *  doing", a row that means nothing is worse than a row that is absent. */
export default function AttentionList({ items }: { items: Metric[] }) {
  const readable = items.filter((item) => item.count !== null);

  if (readable.length === 0) {
    return (
      <p className={styles.attentionEmpty}>
        None of these checks could be read right now. They are counts over the
        catalogue, so this usually means the database is not answering.
      </p>
    );
  }

  return (
    <ul className={styles.attentionList}>
      {readable.map((item) => {
        const clear = item.count === 0;
        return (
          <li className={styles.attentionRow} key={item.key}>
            <Link
              className={styles.attentionLink}
              data-clear={clear ? "true" : "false"}
              data-tone={item.tone}
              href={item.href}
              prefetch={false}
            >
              <span aria-hidden="true" className={styles.attentionCount}>
                {clear ? "✓" : item.count}
              </span>
              <span className={styles.attentionText}>
                <span className={styles.attentionLabel}>
                  {item.label}
                  <span className={styles.srOnly}>
                    {clear ? ": none, nothing to do" : `: ${item.count}`}
                  </span>
                </span>
                <span className={styles.attentionHint}>
                  {clear ? "Nothing waiting." : item.hint}
                </span>
              </span>
              <span aria-hidden="true" className={styles.attentionChevron}>
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
