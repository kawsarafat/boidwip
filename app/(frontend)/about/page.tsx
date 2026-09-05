import type { Metadata } from "next";
import StaticPageBody from "@/components/StaticPageBody";
import { OG_IMAGE } from "@/lib/og";

// Bare, with no site name: the layout's title template appends " | বইদ্বীপ" to
// this exact string — for <title>, og:title and twitter:title alike. Spelling
// the brand out here is what produced "… | বইদ্বীপ | বইদ্বীপ".
const title = "আমাদের সম্পর্কে";
const description =
  "বইদ্বীপ সম্পর্কে জানুন: পাবলিক ডোমেইন ও অনুমতিপ্রাপ্ত বাংলা বইয়ের ফ্রি PDF, অনলাইনে পড়া ও রিভিউ কীভাবে বাছাই ও প্রকাশ করা হয়, আর কপিরাইট নীতি কী।";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    title,
    description,
    url: "/about",
    type: "website",
    images: [OG_IMAGE],
  },
};

export default function AboutPage() {
  return <StaticPageBody slug="about" />;
}
