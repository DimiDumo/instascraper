import { Hono } from "hono";
import type { AppBindings } from "../types";
import { makeDb } from "../db/client";
import { listTags, setTagTracked, deleteTag, listTrackedHashtags } from "../db/queries";

export const tagsRoute = new Hono<AppBindings>();

tagsRoute.get("/", async (c) => {
  return c.json({ rows: await listTags(makeDb(c.env.DB)) });
});

tagsRoute.get("/tracked", async (c) => {
  return c.json({ rows: await listTrackedHashtags(makeDb(c.env.DB)) });
});

tagsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = (body?.name as string | undefined)?.trim().replace(/^#/, "");
  if (!name) return c.json({ error: "name required" }, 400);
  const tag = await setTagTracked(makeDb(c.env.DB), name, body?.isTracked ?? true, body?.priority);
  return c.json(tag);
});

tagsRoute.patch("/:name", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const tag = await setTagTracked(
    makeDb(c.env.DB),
    c.req.param("name"),
    body?.isTracked ?? true,
    body?.priority,
  );
  return c.json(tag);
});

tagsRoute.delete("/:name", async (c) => {
  await deleteTag(makeDb(c.env.DB), c.req.param("name"));
  return c.json({ ok: true });
});
