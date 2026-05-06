import { Hono } from "hono";
import { listTags, setTagTracked, deleteTag } from "../../src/db";

export const tagsRoute = new Hono();

tagsRoute.get("/", (c) => {
  return c.json({ rows: listTags() });
});

tagsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = (body?.name as string | undefined)?.trim().replace(/^#/, "");
  if (!name) return c.json({ error: "name required" }, 400);
  const tag = setTagTracked(name, body?.isTracked ?? true, body?.priority);
  return c.json(tag);
});

tagsRoute.patch("/:name", async (c) => {
  const name = c.req.param("name");
  const body = await c.req.json().catch(() => ({}));
  const tag = setTagTracked(name, body?.isTracked ?? true, body?.priority);
  return c.json(tag);
});

tagsRoute.delete("/:name", (c) => {
  deleteTag(c.req.param("name"));
  return c.json({ ok: true });
});
