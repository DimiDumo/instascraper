import {
  createJob,
  startJob,
  completeJob,
  failJob,
  updateJobProgress,
  getJob,
  getRecentJobs,
  getRunningJobs,
  type ScrapeJob,
} from "../db";

export type JobType = "hashtag" | "artist";

export function createScrapeJob(jobType: JobType, target: string) {
  const job = createJob({ jobType, target });
  console.log(`Job created: ${jobType}/${target} (ID: ${job.id})`);
  return job;
}

export function startScrapeJob(jobId: number) {
  startJob(jobId);
  console.log(`Job ${jobId} started`);
}

export function completeScrapeJob(jobId: number, itemsScraped: number) {
  completeJob(jobId, itemsScraped);
  console.log(`Job ${jobId} completed with ${itemsScraped} items`);
}

export function failScrapeJob(jobId: number, errorMessage: string) {
  failJob(jobId, errorMessage);
  console.log(`Job ${jobId} failed: ${errorMessage}`);
}

export function updateProgress(jobId: number, itemsScraped: number) {
  updateJobProgress(jobId, itemsScraped);
}

export function getJobStatus(jobId: number) {
  const job = getJob(jobId);
  if (!job) {
    console.error(`Job ${jobId} not found`);
    return null;
  }
  return job;
}

export function listJobs(limit = 20) {
  const jobs = getRecentJobs(limit);
  return jobs;
}

export function listRunningJobs() {
  return getRunningJobs();
}

function formatJob(job: ScrapeJob): string {
  const status = job.status?.toUpperCase() || "UNKNOWN";
  const statusColor = {
    PENDING: "\x1b[33m",
    RUNNING: "\x1b[36m",
    COMPLETED: "\x1b[32m",
    FAILED: "\x1b[31m",
    UNKNOWN: "\x1b[0m",
  }[status] || "\x1b[0m";

  const reset = "\x1b[0m";
  const duration = job.startedAt && job.completedAt
    ? `${Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s`
    : job.startedAt
    ? "running..."
    : "-";

  return `${job.id}\t${statusColor}${status}${reset}\t${job.jobType}\t${job.target}\t${job.itemsScraped || 0}\t${duration}`;
}

// CLI handlers
export function handleCreateJob(jobType: string, target: string) {
  if (jobType !== "hashtag" && jobType !== "artist") {
    console.error("Invalid job type. Use 'hashtag' or 'artist'");
    process.exit(1);
  }

  const job = createScrapeJob(jobType, target);
  console.log(JSON.stringify({ success: true, jobId: job.id }));
  return job;
}

export function handleStartJob(jobId: string) {
  const id = parseInt(jobId, 10);
  startScrapeJob(id);
  console.log(JSON.stringify({ success: true }));
}

export function handleCompleteJob(jobId: string, itemsScraped: string) {
  const id = parseInt(jobId, 10);
  const count = parseInt(itemsScraped, 10);
  completeScrapeJob(id, count);
  console.log(JSON.stringify({ success: true }));
}

export function handleFailJob(jobId: string, errorMessage: string) {
  const id = parseInt(jobId, 10);
  failScrapeJob(id, errorMessage);
  console.log(JSON.stringify({ success: true }));
}

export function handleUpdateProgress(jobId: string, itemsScraped: string) {
  const id = parseInt(jobId, 10);
  const count = parseInt(itemsScraped, 10);
  updateProgress(id, count);
}

export function handleListJobs() {
  const jobs = listJobs();

  if (jobs.length === 0) {
    console.log("No jobs found");
    return;
  }

  console.log("ID\tSTATUS\t\tTYPE\t\tTARGET\t\tITEMS\tDURATION");
  console.log("-".repeat(70));
  for (const job of jobs) {
    console.log(formatJob(job));
  }
}

export function handleGetJob(jobId: string) {
  const id = parseInt(jobId, 10);
  const job = getJobStatus(id);
  if (job) {
    console.log(JSON.stringify(job, null, 2));
  }
}
