import Link from "next/link";
import { Gutter } from "@payloadcms/ui";
import type { AdminViewServerProps } from "payload";
import AttentionList from "./AttentionList";
import StatCard from "./StatCard";
import { loadDashboardData } from "./queries";
import styles from "./Dashboard.module.css";

/** The /admin index, replacing Payload's widget grid.
 *
 *  WHAT PAYLOAD GIVES YOU AND WHY IT IS NOT ENOUGH HERE. The stock dashboard is
 *  a grid of one card per collection: thirteen equally-weighted rectangles, in
 *  which "Books" and "Evidence files" are the same size and the same colour, and
 *  which answers exactly one question — where do I click to see a list. It never
 *  answers the question an editor actually opens the CMS with, which is "what
 *  needs me". So this view keeps the entity grid (it is genuinely the fastest
 *  route into a list) and puts three things above it: who you are and what you
 *  can start, four numbers that describe the catalogue, and every check that can
 *  produce work — each of those linked to precisely the rows it counted.
 *
 *  THE CONTRACT WITH THE WRAPPER, which is easy to break by copying a Payload
 *  example. `DashboardView` (node_modules/@payloadcms/next/dist/views/Dashboard)
 *  already renders `HydrateAuthProvider` and `SetStepNav nav={[]}` around
 *  whatever it resolves from `views.dashboard.Component`. Rendering `SetStepNav`
 *  again here would set the breadcrumb twice on every navigation into the
 *  dashboard; rendering `HydrateAuthProvider` again would remount the auth
 *  context under itself. This component renders neither.
 *
 *  `navGroups` arrives as a serverProp, already filtered by read permission and
 *  `visibleEntities` — the same array the sidebar is built from, which is what
 *  keeps this grid and the nav from ever disagreeing.
 *
 *  A SERVER COMPONENT, with no `use client` anywhere in this folder. Every number
 *  on the page is a `count()` that has to run on the server anyway, so shipping
 *  any of this to the browser would buy nothing and cost a hydration pass. */

/** The nav-group shape `getNavGroups` returns. Declared structurally rather than
 *  imported from `@payloadcms/ui/shared`, because `EntityType` is a TypeScript
 *  enum: importing it would mean comparing an enum member where a plain string
 *  is what actually arrives at runtime. */
type NavGroup = {
  entities: { label: unknown; slug: string; type: string }[];
  label: string;
};

type Props = AdminViewServerProps & { navGroups?: NavGroup[] };

/** Bangladesh time, not the server's.
 *
 *  Vercel functions run in UTC, which is six hours behind Dhaka: an editor
 *  opening the panel at 8am in Dhaka would be greeted with "Good evening", and
 *  computing it in the browser instead would mean either a hydration mismatch or
 *  a greeting that flickers. The site is Bengali and its editors are in
 *  Bangladesh, so the timezone is a fact about the product, not a guess. */
function dhakaHour(): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    hour12: false,
    timeZone: "Asia/Dhaka",
  }).format(new Date());
  const parsed = Number(hour);
  return Number.isFinite(parsed) ? parsed % 24 : 12;
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good evening";
}

function dhakaDate(): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Dhaka",
    weekday: "long",
  }).format(new Date());
}

/** A `StaticLabel` is either a string or a per-language record. Payload's own nav
 *  resolves it through `getTranslation`; this does the same job without importing
 *  from `@payloadcms/translations`, which is Payload's dependency rather than
 *  this project's. */
function labelOf(label: unknown, language: string, fallback: string): string {
  if (typeof label === "string") return label;
  if (label && typeof label === "object") {
    const record = label as Record<string, unknown>;
    const candidate = record[language] ?? record.en;
    if (typeof candidate === "string") return candidate;
    const first = Object.values(record).find((value) => typeof value === "string");
    if (typeof first === "string") return first;
  }
  return fallback;
}

export default async function Dashboard(props: Props) {
  const { i18n, navGroups = [], payload, permissions, user } = props;
  const req = props.initPageResult.req;
  const adminRoute = payload.config.routes.admin;
  const language = i18n?.language ?? "en";

  const { allClear, attention, stats } = await loadDashboardData({
    adminRoute,
    payload,
    permissions,
    req,
  });

  const canCreate = (slug: string) => Boolean(permissions?.collections?.[slug]?.create);
  const quickActions = [
    { label: "New book", slug: "books" },
    { label: "New chapter", slug: "book-chapters" },
    { label: "New reading list", slug: "lists" },
  ].filter((action) => canCreate(action.slug));

  const firstName = (typeof user?.name === "string" ? user.name : "").trim().split(/\s+/)[0];
  const waiting = attention.filter((item) => (item.count ?? 0) > 0).length;

  return (
    <Gutter className={styles.page}>
      <header className={styles.greeting}>
        <div className={styles.greetingText}>
          <h1 className={styles.greetingTitle}>
            {greetingFor(dhakaHour())}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className={styles.greetingMeta}>
            {dhakaDate()}
            {" · "}
            {allClear
              ? "Everything is clear."
              : waiting === 0
                ? "Nothing is waiting on you."
                : `${waiting} ${waiting === 1 ? "thing needs" : "things need"} a look.`}
          </p>
        </div>
        {quickActions.length > 0 && (
          <div className={styles.actions}>
            {quickActions.map((action, index) => (
              <Link
                className={styles.action}
                data-variant={index === 0 ? "primary" : "secondary"}
                href={`${adminRoute}/collections/${action.slug}/create`}
                key={action.slug}
                prefetch={false}
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <section aria-labelledby="bdw-catalogue-heading" className={styles.section}>
        <h2 className={styles.sectionTitle} id="bdw-catalogue-heading">
          The catalogue
        </h2>
        <div className={styles.statGrid}>
          {stats.map((metric) => (
            <StatCard key={metric.key} metric={metric} />
          ))}
        </div>
      </section>

      <section aria-labelledby="bdw-attention-heading" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle} id="bdw-attention-heading">
            Needs attention
          </h2>
          <p className={styles.sectionHint}>
            Each row links to exactly the documents it counted.
          </p>
        </div>
        <div className={styles.panel}>
          <AttentionList items={attention} />
        </div>
      </section>

      {navGroups.length > 0 && (
        <section aria-labelledby="bdw-everything-heading" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle} id="bdw-everything-heading">
              Everything else
            </h2>
            <p className={styles.sectionHint}>
              The same grouping as the sidebar, for when you know where you are going.
            </p>
          </div>
          <div className={styles.entityGrid}>
            {navGroups.map((group) => (
              <div className={styles.entityCard} key={group.label}>
                <h3 className={styles.entityGroup}>{group.label}</h3>
                <ul className={styles.entityList}>
                  {group.entities.map((entity) => (
                    <li key={`${entity.type}-${entity.slug}`}>
                      <Link
                        className={styles.entityLink}
                        href={`${adminRoute}/${
                          entity.type === "globals" ? "globals" : "collections"
                        }/${entity.slug}`}
                        prefetch={false}
                      >
                        {labelOf(entity.label, language, entity.slug)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </Gutter>
  );
}
