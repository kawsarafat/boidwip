import type { Metadata } from "next";
import StaticPageBody from "@/components/StaticPageBody";
import { OG_IMAGE } from "@/lib/og";

// Bare: the layout's title template appends the site name once. See /about.
const title = "প্রাইভেসি পলিসি";
const description =
  "বইদ্বীপ কীভাবে দর্শনার্থীদের তথ্যের সাথে আচরণ করে: কুকি, বিজ্ঞাপন, রিভিউ জমা ও অ্যাফিলিয়েট লিংক সংক্রান্ত নীতিমালা।";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy-policy" },
  openGraph: {
    title,
    description,
    url: "/privacy-policy",
    type: "website",
    images: [OG_IMAGE],
  },
};

export default function PrivacyPolicyPage() {
  return <StaticPageBody slug="privacy-policy" />;
}
