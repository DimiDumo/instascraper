import { Hono } from "hono";
import * as cloud from "../../src/cloud/client";
import { jobQueue } from "../services/job-queue";
import { cancelAgent } from "../agents";

// Local server only handles orchestration: enqueueing scrape jobs (which inserts
// rows in cloud D1) and cancelling running subprocesses. Data reads happen via
// the cloud Worker.
export const jobsRoute = new Hono();

jobsRoute.get("/queue", async (c) => c.json(await jobQueue.status()));

jobsRoute.post("/scrape-hashtag", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const tag = (body?.hashtag as string | undefined)?.trim().replace(/^#/, "");
  if (!tag) return c.json({ error: "hashtag required" }, 400);
  const job = await jobQueue.enqueue({ jobType: "hashtag", target: tag });
  return c.json(job, 201);
});

jobsRoute.post("/scrape-artist", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = (body?.username as string | undefined)?.trim().replace(/^@/, "");
  if (!username) return c.json({ error: "username required" }, 400);
  const job = await jobQueue.enqueue({ jobType: "artist", target: username });
  return c.json(job, 201);
});

jobsRoute.post("/:id/cancel", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400);
  const killed = cancelAgent(id);
  await cloud.jobs.fail(id, "cancelled by user");
  return c.json({ ok: true, killed });
});

jobsRoute.post("/run-tracked", async (c) => {
  const { rows: tracked } = await cloud.tags.tracked();
  if (tracked.length === 0) return c.json({ error: "no tracked tags" }, 400);
  const enqueued = await Promise.all(
    tracked.map((t: any) => jobQueue.enqueue({ jobType: "hashtag", target: t.name })),
  );
  return c.json({ enqueued }, 201);
});
