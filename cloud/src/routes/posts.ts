import { Hono } from "hono";
import type { AppBindings } from "../types";
import { makeDb } from "../db/client";
import {
  upsertPost,
  getPostByShortcode,
  updatePostImageKey,
  insertImage,
  linkPostToHashtag,
  upsertHashtag,
  getArtistByUsername,
} from "../db/queries";

export const postsRoute = new Hono<AppBindings>();

// Mirrors the legacy `bun run cli db save-post '<json>'` payload shape:
// { artistUsername, shortcode, ..., images?: [{url, width, height}], hashtags?: ["tag", ...] }
postsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.shortcode !== "string" || typeof body.artistUsername !== "string") {
    return c.json({ error: "shortcode and artistUsername required" }, 400);
  }
  const db = makeDb(c.env.DB);
  const artist = await getArtistByUsername(db, body.artistUsername);
  if (!artist) return c.json({ error: "artist not found — upsert artist first" }, 400);

  const { artistUsername, images: imgs, hashtags: tags, postedAt, ...rest } = body;
  const post = await upsertPost(db, {
    ...rest,
    artistId: artist.id,
    postedAt: postedAt ? new Date(postedAt) : undefined,
  });

  if (Array.isArray(imgs) && post) {
    for (const img of imgs) {
      if (typeof img?.url === "string") {
        await insertImage(db, {
          postId: post.id!,
          url: img.url,
          width: img.width ?? null,
          height: img.height ?? null,
        });
      }
    }
  }

  if (Array.isArray(tags) && post) {
    for (const tagName of tags) {
      if (typeof tagName !== "string" || tagName.length === 0) continue;
      const tag = await upsertHashtag(db, { name: tagName.replace(/^#/, "") });
      if (tag?.id) await linkPostToHashtag(db, post.id!, tag.id);
    }
  }

  return c.json(post);
});

postsRoute.get("/:shortcode", async (c) => {
  const db = makeDb(c.env.DB);
  const post = await getPostByShortcode(db, c.req.param("shortcode"));
  if (!post) return c.json({ error: "not found" }, 404);
  return c.json(post);
});

postsRoute.patch("/:shortcode/image-key", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.key !== "string") return c.json({ error: "key required" }, 400);
  const db = makeDb(c.env.DB);
  const shortcode = c.req.param("shortcode");
  const updated = await updatePostImageKey(db, shortcode, body.key);
  if (!updated) return c.json({ error: `post not found: ${shortcode}. save-post must run before images upload.` }, 404);
  return c.json({ ok: true });
});
