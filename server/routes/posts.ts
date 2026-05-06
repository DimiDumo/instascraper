import { Hono } from "hono";
import { getPostByShortcode } from "../../src/db";

export const postsRoute = new Hono();

postsRoute.get("/:shortcode", (c) => {
  const post = getPostByShortcode(c.req.param("shortcode"));
  if (!post) return c.json({ error: "not found" }, 404);
  return c.json(post);
});
