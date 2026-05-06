import { runAgent } from "../agents";
import { startJob, completeJob, failJob, getJob } from "../../src/db";
import { emit } from "./events";
import { appendLog } from "./log-buffer";

export interface RunJobInput {
  jobId: number;
  prompt: string;
}

function ts() {
  return new Date().toISOString().slice(11, 23);
}

export async function runJob(input: RunJobInput): Promise<void> {
  const { jobId, prompt } = input;
  startJob(jobId);
  const cmd = process.env.AGENT_CMD?.trim() || "claude";
  const argStr =
    process.env.AGENT_ARGS ?? "-p --chrome --dangerously-skip-permissions --output-format stream-json --verbose";
  const banner = `[job ${jobId}] starting: ${cmd} ${argStr} "${prompt.slice(0, 120)}…"`;
  console.log(banner);
  appendLog(jobId, banner, "system");
  emit({ type: "job.update", jobId });

  let result: Awaited<ReturnType<typeof runAgent>>;
  try {
    result = await runAgent({
      prompt,
      jobId,
      env: { INSTASCRAPER_JOB_ID: String(jobId) },
      onLine: (line, stream) => {
        appendLog(jobId, line, stream);
        const prefix = stream === "stderr" ? `[job ${jobId} stderr]` : `[job ${jobId}]`;
        console.log(`${ts()} ${prefix} ${line}`);
        emit({ type: "job.log", jobId, line, stream });
        if (stream === "stdout") emit({ type: "job.update", jobId });
      },
    });

    if (result.cancelled) {
      failJob(jobId, "cancelled by user");
      const msg = `[job ${jobId}] cancelled`;
      console.warn(msg);
      appendLog(jobId, msg, "system");
    } else if (result.exitCode === 0) {
      const fresh = getJob(jobId);
      // Skill may have already marked the job failed via `bun run cli job fail`.
      // Respect that — don't override to completed.
      if (fresh?.status === "failed") {
        const msg = `[job ${jobId}] FAILED (skill reported): ${fresh.errorMessage ?? "(no message)"}`;
        console.error(msg);
        appendLog(jobId, msg, "system");
      } else {
        const items = fresh?.itemsScraped ?? 0;
        completeJob(jobId, items);
        const done = `[job ${jobId}] done — ${items} items scraped`;
        console.log(done);
        appendLog(jobId, done, "system");
      }
    } else {
      const fail = `[job ${jobId}] FAILED (exit ${result.exitCode})`;
      failJob(jobId, fail);
      console.error(fail);
      appendLog(jobId, fail, "system");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    failJob(jobId, msg);
    console.error(`[job ${jobId}] threw:`, msg);
    appendLog(jobId, `threw: ${msg}`, "system");
  } finally {
    emit({ type: "job.update", jobId });
  }
}
