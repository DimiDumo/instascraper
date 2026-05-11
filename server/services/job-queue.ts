import * as cloud from "../../src/cloud/client";
import { emit } from "./events";

export interface EnqueueInput {
  jobType: "hashtag" | "artist";
  target: string;
}

/**
 * Manual mode: enqueue = insert pending row in cloud D1. The user runs
 * `/scrape-next` inside their own Claude Code session to drain the queue. We
 * don't spawn subprocesses here so Chrome MCP is owned by exactly one Claude
 * instance (the user's interactive one) and we avoid Playwright fallback.
 *
 * State of pending/running jobs lives in D1 — this class is now stateless and
 * just translates calls into cloud Worker requests.
 */
class JobQueue {
  async enqueue(input: EnqueueInput) {
    const job = await cloud.jobs.create(input.jobType, input.target);
    emit({ type: "queue.update" });
    emit({ type: "job.update", jobId: job.id });
    return job;
  }

  async status() {
    const [pendingRes, runningRes] = await Promise.all([
      cloud.jobs.list({ limit: 100, status: "pending" }),
      cloud.jobs.list({ limit: 1, status: "running" }),
    ]);
    const pending = pendingRes.rows.map((j: any) => ({
      jobId: j.id,
      jobType: j.jobType as "hashtag" | "artist",
      target: j.target,
    }));
    const top = runningRes.rows[0];
    const running = top
      ? { jobId: top.id, jobType: top.jobType as "hashtag" | "artist", target: top.target }
      : null;
    return { running, pending };
  }
}

export const jobQueue = new JobQueue();
