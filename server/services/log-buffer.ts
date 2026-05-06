interface LogLine {
  ts: number;
  stream: "stdout" | "stderr" | "system";
  line: string;
}

const MAX_LINES_PER_JOB = 2000;
const buffers = new Map<number, LogLine[]>();

export function appendLog(jobId: number, line: string, stream: "stdout" | "stderr" | "system" = "stdout"): void {
  let buf = buffers.get(jobId);
  if (!buf) {
    buf = [];
    buffers.set(jobId, buf);
  }
  buf.push({ ts: Date.now(), stream, line });
  if (buf.length > MAX_LINES_PER_JOB) buf.splice(0, buf.length - MAX_LINES_PER_JOB);
}

export function getLogs(jobId: number): LogLine[] {
  return buffers.get(jobId) ?? [];
}

export function clearOldLogs(keepJobIds: Set<number>): void {
  for (const id of buffers.keys()) {
    if (!keepJobIds.has(id)) buffers.delete(id);
  }
}
