/* Payload's official app-router template. Renders the CMS's own styled 404
 * for unknown /admin paths, rather than falling through to the public site's
 * app/(frontend)/not-found.tsx — which would be jarring, and would render
 * the site header and footer inside the admin panel. */
import type { Metadata } from "next";

import config from "@payload-config";
import { generatePageMetadata, NotFoundPage } from "@payloadcms/next/views";

import { importMap } from "../importMap.js";

type Args = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams: Promise<{
    [key: string]: string | string[];
  }>;
};

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams });

const NotFound = ({ params, searchParams }: Args) =>
  NotFoundPage({ config, importMap, params, searchParams });

export default NotFound;
