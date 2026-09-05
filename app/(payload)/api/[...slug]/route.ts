/* Payload's official app-router template — the whole REST API on one
 * catch-all route.
 *
 * Note on coexistence: the site keeps its own static /api/cron/rebuild route
 * over in app/(frontend). Next resolves static segments before dynamic ones
 * and catch-alls last, so that route still wins its own path and only
 * genuinely-Payload paths (/api/chapters, /api/users/login, …) reach here. */
import config from "@payload-config";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from "@payloadcms/next/routes";

export const GET = REST_GET(config);
export const POST = REST_POST(config);
export const DELETE = REST_DELETE(config);
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);
export const OPTIONS = REST_OPTIONS(config);
