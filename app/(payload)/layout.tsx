/* This file follows Payload's official app-router template. Keep it in sync
 * with `node_modules/payload/templates` when upgrading Payload — it is the
 * seam between Next's router and the CMS, not application code.
 *
 * Why this route group exists at all: this layout renders its OWN <html> and
 * <body> (the admin panel is a full single-page app with its own reset and
 * theming), and so does app/(frontend)/layout.tsx. Next allows exactly one
 * root layout per route group, so the site and the CMS have to be siblings
 * — (frontend) and (payload) — rather than one nested inside the other.
 * Route groups don't appear in URLs, so nothing about the public site's
 * addresses changes. */
import type { ServerFunctionClient } from "payload";

import config from "@payload-config";
import { handleServerFunctions, RootLayout } from "@payloadcms/next/layouts";
import React from "react";

import "@payloadcms/next/css";

/* The Boidwip admin theme. Six files, imported here rather than through
 * Payload's `admin.css` config option, because that option's SCSS hook is
 * commented out upstream — see the `@import '~payload-user-css'` TODO at the
 * bottom of node_modules/@payloadcms/ui/dist/scss/app.scss. A layout import is
 * the supported path and it puts the load order in one visible place.
 *
 * ORDER MATTERS, in one direction only.
 *
 * Against Payload these files always win: everything Payload ships is inside
 * `@layer payload-default`, and unlayered CSS beats layered CSS at any
 * specificity (see app/(payload)/theme/tokens.css). Against each other the
 * ordinary cascade applies, so they go general to specific and responsive.css
 * goes last — a max-width rule does not outrank a plain rule of equal
 * specificity, it only wins by coming later.
 *
 * surfaces.css sits after chrome.css for that reason and not by preference: it
 * repaints `.nav`, which chrome.css also sets, at the same specificity. views.css
 * sits after both for the same reason: it re-fills `.list-controls`, which
 * chrome.css gives a margin, and it reads the `--bdw-canvas` that surfaces.css
 * declares.
 *
 * Not imported into app/(frontend): the public site is Tailwind and never loads
 * Payload's stylesheet, so these tokens would have nothing to override there. */
import "./theme/tokens.css";
import "./theme/chrome.css";
import "./theme/surfaces.css";
import "./theme/fields.css";
import "./theme/views.css";
import "./theme/responsive.css";

import { importMap } from "./admin/importMap.js";

type Args = {
  children: React.ReactNode;
};

/** Payload's admin UI calls back into the server for things like form state
 *  and live preview. This is the single entry point for those calls. */
const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  });
};

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
);

export default Layout;
