import * as cloud from "../cloud/client";

export type JobType = "hashtag" | "artist";

export async function createScrapeJob(jobType: JobType, target: string) {
  const job = await cloud.jobs.create(jobType, target);
  console.log(`Job created: ${jobType}/${target} (ID: ${job.id})`);
  return job;
}

export async function startScrapeJob(jobId: number) {
  await cloud.jobs.start(jobId);
  console.log(`Job ${jobId} started`);
}

export async function completeScrapeJob(jobId: number, itemsScraped: number) {
  await cloud.jobs.complete(jobId, itemsScraped);
  console.log(`Job ${jobId} completed with ${itemsScraped} items`);
}

export async function failScrapeJob(jobId: number, errorMessage: string) {
  await cloud.jobs.fail(jobId, errorMessage);
  console.log(`Job ${jobId} failed: ${errorMessage}`);
}

export async function updateProgress(jobId: number, itemsScraped: number) {
  await cloud.jobs.progress(jobId, itemsScraped);
}

export async function getJobStatus(jobId: number) {
  return cloud.jobs.get(jobId).catch(() => null);
}

function formatJob(job: any): string {
  const status = (job.status?.toUpperCase?.() as string) || "UNKNOWN";
  const statusColor =
    {
      PENDING: "\x1b[33m",
      RUNNING: "\x1b[36m",
      COMPLETED: "\x1b[32m",
      FAILED: "\x1b[31m",
      UNKNOWN: "\x1b[0m",
    }[status] || "\x1b[0m";

  const reset = "\x1b[0m";
  const duration =
    job.startedAt && job.completedAt
      ? `${Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s`
      : job.startedAt
        ? "running..."
        : "-";

  return `${job.id}\t${statusColor}${status}${reset}\t${job.jobType}\t${job.target}\t${
    job.itemsScraped || 0
  }\t${duration}`;
}

// CLI handlers
export async function handleCreateJob(jobType: string, target: string) {
  if (jobType !== "hashtag" && jobType !== "artist") {
    console.error("Invalid job type. Use 'hashtag' or 'artist'");
    process.exit(1);
  }
  const job = await createScrapeJob(jobType, target);
  console.log(JSON.stringify({ success: true, jobId: job.id }));
  return job;
}

export async function handleStartJob(jobId: string) {
  await startScrapeJob(parseInt(jobId, 10));
  console.log(JSON.stringify({ success: true }));
}

export async function handleCompleteJob(jobId: string, itemsScraped: string) {
  await completeScrapeJob(parseInt(jobId, 10), parseInt(itemsScraped, 10));
  console.log(JSON.stringify({ success: true }));
}

export async function handleFailJob(jobId: string, errorMessage: string) {
  await failScrapeJob(parseInt(jobId, 10), errorMessage);
  console.log(JSON.stringify({ success: true }));
}

export async function handleUpdateProgress(jobId: string, itemsScraped: string) {
  await updateProgress(parseInt(jobId, 10), parseInt(itemsScraped, 10));
}

export async function handleListJobs() {
  const { rows } = await cloud.jobs.list({ limit: 20 });
  if (rows.length === 0) {
    console.log("No jobs found");
    return;
  }
  console.log("ID\tSTATUS\t\tTYPE\t\tTARGET\t\tITEMS\tDURATION");
  console.log("-".repeat(70));
  for (const job of rows) console.log(formatJob(job));
}

export async function handleGetJob(jobId: string) {
  const job = await getJobStatus(parseInt(jobId, 10));
  if (job) console.log(JSON.stringify(job, null, 2));
  else console.error(`Job ${jobId} not found`);
}

export async function handleNextJob() {
  const result = await cloud.jobs.claimNext();
  console.log(JSON.stringify(result));
}

export async function handlePendingCount() {
  const { pending } = await cloud.jobs.pendingCount();
  console.log(JSON.stringify({ pending }));
}
