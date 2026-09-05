import type { Metadata } from "next";
import StaticPageBody from "@/components/StaticPageBody";
import { OG_IMAGE } from "@/lib/og";

// Bare: the layout's title template appends the site name once. See /about.
const title = "যোগাযোগ";
const description =
  "বইদ্বীপের সাথে যোগাযোগ করুন: কপিরাইট সংক্রান্ত আপত্তি, ভুল সংশোধন, নতুন বইয়ের অনুরোধ বা যেকোনো মতামতের জন্য।";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: {
    title,
    description,
    url: "/contact",
    type: "website",
    images: [OG_IMAGE],
  },
};

export default function ContactPage() {
  return <StaticPageBody slug="contact" />;
}
