import type { GlobalConfig } from "payload";
import { authenticated, publicRead } from "../lib/payload/access";
import { rebuildOnGlobalChange } from "../lib/payload/revalidate";

/** Editorial strings around the affiliate layer — the disclosure sentence,
 *  the button labels, and the kill switch. Kept separate from SiteSettings
 *  because these have compliance weight: the disclosure line is a legal
 *  requirement of running affiliate links, and an editor should find it in
 *  one obvious place rather than buried among social links.
 *
 *  The affiliate PARAMETERS themselves (affId, affs, cma) are env vars
 *  (NEXT_PUBLIC_ROKOMARI_AFFILIATE_ID / _AFFS / _CMA) read by
 *  lib/affiliate.ts — deliberately NOT here. A typo'd affId silently
 *  forfeits every commission; that class of value should require a deploy
 *  and a diff review, not survive one mistaken admin save. */
export const AffiliateSettings: GlobalConfig = {
  slug: "affiliate-settings",
  label: "Affiliate Settings",
  admin: {
    group: "Settings",
    description:
      "Buy-button labels and the mandatory affiliate disclosure line. Every string here renders on every book page, so saving triggers a rebuild and the change is live when that deployment finishes. The affiliate ID itself is configured by the developer, not here.",
  },
  access: {
    read: publicRead,
    update: authenticated,
  },
  hooks: {
    // Every string here renders on every page (the disclosure line sits under
    // each buy button), so a save is site-wide by definition and triggers a
    // deployment — see lib/payload/revalidate.ts. The hook honours
    // `context: { skipRevalidate: true }` itself, which is what the seed
    // script passes.
    afterChange: [rebuildOnGlobalChange],
  },
  fields: [
    {
      name: "affiliateEnabled",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description:
          "Master switch. Off = buy buttons still render but link to plain Rokomari URLs without affiliate parameters.",
      },
    },
    {
      name: "buyButtonLabel",
      type: "text",
      required: true,
      defaultValue: "হার্ডকপি কিনুন",
      admin: {
        description: "Label on the primary buy button (green).",
      },
    },
    {
      name: "downloadButtonLabel",
      type: "text",
      required: true,
      defaultValue: "ফ্রি পিডিএফ ডাউনলোড",
      admin: {
        description: "Label on the free-PDF download button (blue).",
      },
    },
    {
      name: "disclosureText",
      type: "textarea",
      required: true,
      defaultValue:
        "বইদ্বীপ রকমারি অ্যাফিলিয়েট প্রোগ্রামের সদস্য। এই লিংক থেকে বই কিনলে আপনার কোনো বাড়তি খরচ ছাড়াই আমরা সামান্য কমিশন পাই, যা সাইটটি চালাতে সাহায্য করে।",
      admin: {
        description:
          "Legally required disclosure shown near every affiliate link. Do not remove — only reword.",
      },
    },
    {
      name: "postDownloadHeading",
      type: "text",
      defaultValue: "বইটি ভালো লাগলে হার্ডকপি সংগ্রহ করুন",
      admin: {
        description:
          "Heading of the panel shown after a reader clicks a free-PDF download.",
      },
    },
    {
      name: "postDownloadBody",
      type: "textarea",
      defaultValue:
        "ছাপা বইয়ের আনন্দই আলাদা। আর আপনার কেনা প্রতিটি বই লেখক ও প্রকাশককে নতুন বই আনতে উৎসাহ দেয়।",
      admin: {
        description: "Supporting line in the post-download panel.",
      },
    },
  ],
};

export default AffiliateSettings;
