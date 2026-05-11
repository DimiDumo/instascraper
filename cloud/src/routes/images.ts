import { Hono } from "hono";
import type { AppBindings } from "../types";

export const imagesRoute = new Hono<AppBindings>();

// GET /api/images/<key>  → streams the R2 object bytes.
// Browser hits this through CF Access (so only authorized users can view artwork).
imagesRoute.get("/*", async (c) => {
  const path = c.req.path.replace(/^\/api\/images\//, "");
  // Safety: collapse any traversal segments before R2 lookup.
  const key = path
    .split("/")
    .filter((seg) => seg && seg !== ".." && seg !== ".")
    .join("/");
  if (!key) return c.json({ error: "key required" }, 400);

  const obj = await c.env.IMAGES.get(key);
  if (!obj) return c.json({ error: "not found" }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  // Allow long cache; R2 objects are immutable per key in this project.
  headers.set("cache-control", "private, max-age=86400");
  return new Response(obj.body, { headers });
});
