import { Hono } from "hono";
import { listJobs, getJob, listTrackedHashtags, failJob } from "../../src/db";
import { jobQueue } from "../services/job-queue";
import { cancelAgent } from "../agents";

export const jobsRoute = new Hono();

jobsRoute.get("/", (c) => {
  const url = new URL(c.req.url);
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));
  const status = url.searchParams.get("status") ?? undefined;
  return c.json({
    rows: listJobs({ limit, status: status || undefined }),
    queue: jobQueue.status(),
  });
});

jobsRoute.get("/queue", (c) => c.json(jobQueue.status()));

jobsRoute.get("/:id", (c) => {
  const job = getJob(Number(c.req.param("id")));
  if (!job) return c.json({ error: "not found" }, 404);
  return c.json(job);
});

jobsRoute.post("/scrape-hashtag", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const tag = (body?.hashtag as string | undefined)?.trim().replace(/^#/, "");
  if (!tag) return c.json({ error: "hashtag required" }, 400);
  const job = jobQueue.enqueue({ jobType: "hashtag", target: tag });
  return c.json(job, 201);
});

jobsRoute.post("/scrape-artist", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = (body?.username as string | undefined)?.trim().replace(/^@/, "");
  if (!username) return c.json({ error: "username required" }, 400);
  const job = jobQueue.enqueue({ jobType: "artist", target: username });
  return c.json(job, 201);
});

jobsRoute.post("/:id/cancel", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400);
  // Try to kill subprocess if any (legacy auto-spawn path), then mark failed.
  const killed = cancelAgent(id);
  failJob(id, "cancelled by user");
  return c.json({ ok: true, killed });
});

jobsRoute.post("/run-tracked", (c) => {
  const tracked = listTrackedHashtags();
  if (tracked.length === 0) return c.json({ error: "no tracked tags" }, 400);
  const enqueued = tracked.map((t) =>
    jobQueue.enqueue({ jobType: "hashtag", target: t.name })
  );
  return c.json({ enqueued }, 201);
});
