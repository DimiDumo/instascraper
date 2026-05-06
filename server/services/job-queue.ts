import { createJob, listJobs, type ScrapeJob } from "../../src/db";
import { emit } from "./events";

export interface EnqueueInput {
  jobType: "hashtag" | "artist";
  target: string;
}

/**
 * Manual mode: enqueue = insert pending row in DB. The user runs `/scrape-next`
 * inside their own Claude Code session to drain the queue. We don't spawn
 * subprocesses here so chrome MCP is owned by exactly one Claude instance
 * (the user's interactive one) and we avoid Playwright fallback.
 */
class JobQueue {
  enqueue(input: EnqueueInput): ScrapeJob {
    const job = createJob({ jobType: input.jobType, target: input.target });
    emit({ type: "queue.update" });
    emit({ type: "job.update", jobId: job.id });
    return job;
  }

  status() {
    const pending = listJobs({ limit: 100, status: "pending" }).map((j) => ({
      jobId: j.id,
      jobType: j.jobType as "hashtag" | "artist",
      target: j.target,
    }));
    const runningRows = listJobs({ limit: 1, status: "running" });
    const running = runningRows[0]
      ? { jobId: runningRows[0].id, jobType: runningRows[0].jobType as "hashtag" | "artist", target: runningRows[0].target }
      : null;
    return { running, pending };
  }
}

export const jobQueue = new JobQueue();
