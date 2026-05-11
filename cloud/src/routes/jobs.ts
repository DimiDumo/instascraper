import { Hono } from "hono";
import type { AppBindings } from "../types";
import { makeDb } from "../db/client";
import {
  listJobs,
  getJob,
  createJob,
  startJob,
  completeJob,
  failJob,
  updateJobProgress,
  claimNextPendingJob,
  countPendingJobs,
} from "../db/queries";

export const jobsRoute = new Hono<AppBindings>();

// Read endpoints (used by web dashboard + local server for status checks)
jobsRoute.get("/", async (c) => {
  const url = new URL(c.req.url);
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));
  const status = url.searchParams.get("status") ?? undefined;
  const rows = await listJobs(makeDb(c.env.DB), { limit, status: status || undefined });
  return c.json({ rows });
});

jobsRoute.get("/pending-count", async (c) => {
  return c.json({ pending: await countPendingJobs(makeDb(c.env.DB)) });
});

jobsRoute.post("/claim-next", async (c) => {
  const db = makeDb(c.env.DB);
  const claimed = await claimNextPendingJob(db);
  if (!claimed) return c.json({ done: true, pending: 0 });
  const remaining = await countPendingJobs(db);
  return c.json({ done: false, job: claimed, remaining });
});

jobsRoute.get("/:id", async (c) => {
  const job = await getJob(makeDb(c.env.DB), Number(c.req.param("id")));
  if (!job) return c.json({ error: "not found" }, 404);
  return c.json(job);
});

// Write endpoints — called by local server's job queue to mirror state to cloud.
// Scrape orchestration (enqueueing, cancel, agent spawning) stays local-only.
jobsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const jobType = body?.jobType;
  const target = (body?.target as string | undefined)?.trim();
  if (jobType !== "hashtag" && jobType !== "artist") return c.json({ error: "bad jobType" }, 400);
  if (!target) return c.json({ error: "target required" }, 400);
  const row = await createJob(makeDb(c.env.DB), { jobType, target });
  return c.json(row, 201);
});

jobsRoute.post("/:id/start", async (c) => {
  await startJob(makeDb(c.env.DB), Number(c.req.param("id")));
  return c.json({ ok: true });
});

jobsRoute.post("/:id/progress", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  await updateJobProgress(makeDb(c.env.DB), Number(c.req.param("id")), Number(body?.itemsScraped ?? 0));
  return c.json({ ok: true });
});

jobsRoute.post("/:id/complete", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  await completeJob(makeDb(c.env.DB), Number(c.req.param("id")), Number(body?.itemsScraped ?? 0));
  return c.json({ ok: true });
});

jobsRoute.post("/:id/fail", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  await failJob(makeDb(c.env.DB), Number(c.req.param("id")), String(body?.errorMessage ?? "unknown"));
  return c.json({ ok: true });
});
