import type { Field } from "payload";

/** Shared field fragments that exist to be identical in every collection.
 *
 *  Both of these register a component by string path, which is the only form
 *  `npm run generate:importmap` can see. Declared once here rather than copied
 *  into eight collection configs: the import map is generated from these
 *  strings, so a typo in one copy is a component that silently never renders in
 *  exactly one collection, which is the hardest version of this bug to notice. */

/** The "Live" column: a link from each row of a list view to that document's
 *  page on the site, in a new tab. See components/payload/list/LiveLinkCell.tsx
 *  for what it renders when there is no live page yet.
 *
 *  A `ui` field with a Cell and no Field renders NOTHING in the edit view, so
 *  this adds a column and nothing else. Add "liveLink" to the collection's
 *  `admin.defaultColumns` to have it shown by default; it is available in the
 *  column picker either way. */
export const liveLinkField: Field = {
  name: "liveLink",
  type: "ui",
  label: "Live",
  admin: {
    components: {
      Cell: "/components/payload/list/LiveLinkCell#default",
    },
  },
};

/** The live word count under a prose field, as an `admin.components` fragment.
 *  Spread into the field's admin block:
 *
 *      admin: {
 *        description: "...",
 *        components: wordCount({ target: 100, why: "Below this the page is noindexed." }),
 *      }
 *
 *  `target` is for fields a LENGTH RULE acts on, and `why` states the rule. Omit
 *  both where length is merely interesting: an amber number that means nothing
 *  in particular is how editors learn to ignore amber numbers.
 *
 *  `afterInput` is an ARRAY in the field config (one hook, many components), so
 *  the single entry is wrapped. `clientProps` is merged last by
 *  RenderServerComponent, after the framework's own field/path/permissions, so
 *  none of those names may be reused here.
 *
 *  Not free — renderField.js force-re-renders any field carrying an afterInput
 *  component on every form-state request — so this goes on the prose fields
 *  where length is a decision, not on every string field. */
export function wordCount(opts: { target?: number; why?: string } = {}) {
  return {
    afterInput: [
      {
        path: "/components/payload/fields/WordCount#default",
        clientProps: {
          ...(opts.target !== undefined ? { target: opts.target } : {}),
          ...(opts.why !== undefined ? { targetWhy: opts.why } : {}),
        },
      },
    ],
  };
}
