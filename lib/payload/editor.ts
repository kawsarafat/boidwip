import {
  lexicalEditor,
  BoldFeature,
  ItalicFeature,
  UnderlineFeature,
  StrikethroughFeature,
  SubscriptFeature,
  SuperscriptFeature,
  InlineCodeFeature,
  ParagraphFeature,
  HeadingFeature,
  BlockquoteFeature,
  OrderedListFeature,
  UnorderedListFeature,
  LinkFeature,
  UploadFeature,
  HorizontalRuleFeature,
  EXPERIMENTAL_TableFeature,
  FixedToolbarFeature,
  InlineToolbarFeature,
} from "@payloadcms/richtext-lexical";

/** The one rich-text configuration used by every body field on the site.
 *
 *  This is an explicit feature list rather than Lexical's defaults, for one
 *  concrete reason: whatever the editor can produce has to survive
 *  `sanitizeContentHtml()`'s allowlist in lib/render.ts on the way to the
 *  page. A feature enabled here but missing from that allowlist would
 *  vanish silently after publishing — the editor would show a table, the
 *  live page would show nothing, and there would be no error anywhere. The
 *  two lists are maintained as a matched pair; if you enable a feature
 *  here, add its tags there in the same commit.
 *
 *  Shared by every rich-text field in the catalogue (book descriptions,
 *  chapter bodies, author bios, blog posts, pages, list intros) so they can
 *  only ever emit the same HTML subset, which means one sanitizer allowlist
 *  genuinely covers them all. */
export const contentEditor = lexicalEditor({
  features: () => [
    ParagraphFeature(),
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
    StrikethroughFeature(),
    // Rarely needed in book prose but harmless to keep, and footnote-style
    // markers (১ম সংস্করণ¹) use superscript. The sanitizer allowlist in
    // lib/render.ts includes <sub>/<sup> to match.
    SubscriptFeature(),
    SuperscriptFeature(),
    InlineCodeFeature(),
    // Starts at h2 deliberately: the page title is already the document's
    // only <h1>, and a second one breaks the heading outline that both
    // screen readers and search engines depend on.
    HeadingFeature({ enabledHeadingSizes: ["h2", "h3", "h4"] }),
    UnorderedListFeature(),
    OrderedListFeature(),
    BlockquoteFeature(),
    LinkFeature({
      // Lets an editor link to another catalogue document by picking it, so
      // internal links can't rot into 404s through a typo. Books, authors and
      // lists are the things prose actually cross-references — a review of one
      // book naming another, an author bio naming their publisher.
      enabledCollections: ["books", "authors", "publishers", "lists", "blog-posts"],
    }),
    UploadFeature({
      collections: {
        media: {
          fields: [
            {
              name: "caption",
              type: "text",
              admin: { description: "Optional caption shown beneath the image." },
            },
          ],
        },
      },
    }),
    EXPERIMENTAL_TableFeature(),
    HorizontalRuleFeature(),
    FixedToolbarFeature(),
    InlineToolbarFeature(),
  ],
});
