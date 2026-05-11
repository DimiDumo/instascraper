import { Hono } from "hono";
import type { AppBindings } from "../types";
import { makeDb } from "../db/client";
import { listArtists, getArtistDetail, upsertArtist, getArtistByUsername, getArtistById } from "../db/queries";

export const artistsRoute = new Hono<AppBindings>();

artistsRoute.get("/", async (c) => {
  const url = new URL(c.req.url);
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 60));
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const search = url.searchParams.get("search") ?? undefined;
  const minFollowers = url.searchParams.get("minFollowers");
  const maxFollowers = url.searchParams.get("maxFollowers");
  const result = await listArtists(makeDb(c.env.DB), {
    limit,
    offset,
    search,
    minFollowers: minFollowers ? Number(minFollowers) : undefined,
    maxFollowers: maxFollowers ? Number(maxFollowers) : undefined,
  });
  return c.json(result);
});

artistsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.username !== "string") {
    return c.json({ error: "username required" }, 400);
  }
  const db = makeDb(c.env.DB);
  // Map ISO date strings → Date instances for the timestamp columns.
  const data = {
    ...body,
    scrapedAt: body.scrapedAt ? new Date(body.scrapedAt) : undefined,
  };
  const row = await upsertArtist(db, data);
  return c.json(row);
});

artistsRoute.get("/by-id/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const row = await getArtistById(makeDb(c.env.DB), id);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

artistsRoute.get("/:username", async (c) => {
  const db = makeDb(c.env.DB);
  const detail = await getArtistDetail(db, c.req.param("username"));
  if (!detail) return c.json({ error: "not found" }, 404);
  return c.json(detail);
});

// Quick lookup used by local scraper after upserting an artist
artistsRoute.get("/:username/lite", async (c) => {
  const db = makeDb(c.env.DB);
  const row = await getArtistByUsername(db, c.req.param("username"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

artistsRoute.patch("/:username/profile-pic-key", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.key !== "string") return c.json({ error: "key required" }, 400);
  const db = makeDb(c.env.DB);
  const existing = await getArtistByUsername(db, c.req.param("username"));
  if (!existing) return c.json({ error: "not found" }, 404);
  await upsertArtist(db, { username: existing.username, profilePicKey: body.key });
  return c.json({ ok: true });
});
