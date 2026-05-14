import { Hono } from "hono";
import type { AppBindings } from "../types";
import { makeDb } from "../db/client";
import {
  listArtists,
  getArtistDetail,
  upsertArtist,
  getArtistByUsername,
  getArtistById,
  getArtistSeenStatus,
  upsertRejectedArtist,
  type DmStatus,
} from "../db/queries";

const VALID_REJECT_REASONS = ["out_of_range", "low_score", "manual_review"] as const;
type RejectReason = (typeof VALID_REJECT_REASONS)[number];

const VALID_DM_STATUSES: readonly DmStatus[] = ["none", "draft", "synced", "ready", "sent"];

export const artistsRoute = new Hono<AppBindings>();

artistsRoute.get("/", async (c) => {
  const url = new URL(c.req.url);
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 60));
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const search = url.searchParams.get("search") ?? undefined;
  const minFollowers = url.searchParams.get("minFollowers");
  const maxFollowers = url.searchParams.get("maxFollowers");
  const dmStatusRaw = url.searchParams.get("dmStatus");
  const dmStatuses = dmStatusRaw
    ? dmStatusRaw
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is DmStatus => VALID_DM_STATUSES.includes(s as DmStatus))
    : undefined;
  const result = await listArtists(makeDb(c.env.DB), {
    limit,
    offset,
    search,
    minFollowers: minFollowers ? Number(minFollowers) : undefined,
    maxFollowers: maxFollowers ? Number(maxFollowers) : undefined,
    dmStatuses,
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

// Record an artist evaluated during discovery but deemed not a fit.
artistsRoute.post("/rejected", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.username !== "string") {
    return c.json({ error: "username required" }, 400);
  }
  if (!VALID_REJECT_REASONS.includes(body.reason)) {
    return c.json({ error: `reason must be one of ${VALID_REJECT_REASONS.join(", ")}` }, 400);
  }
  const db = makeDb(c.env.DB);
  const row = await upsertRejectedArtist(db, {
    username: body.username,
    reason: body.reason as RejectReason,
    score: typeof body.score === "number" ? body.score : undefined,
    followersCount: typeof body.followersCount === "number" ? body.followersCount : undefined,
    primaryReason: typeof body.primaryReason === "string" ? body.primaryReason : undefined,
    sourceHashtag: typeof body.sourceHashtag === "string" ? body.sourceHashtag : undefined,
    evaluatedAt: body.evaluatedAt ? new Date(body.evaluatedAt) : undefined,
  });
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

// Combined dedup check used by the scraper skills before any browser/AI work.
// Returns scraped (with dmStatus), rejected, or new — always 200.
artistsRoute.get("/:username/seen", async (c) => {
  const db = makeDb(c.env.DB);
  const result = await getArtistSeenStatus(db, c.req.param("username"));
  return c.json(result);
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
