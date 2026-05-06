import { spawn, type ChildProcess } from "node:child_process";

export interface RunAgentOptions {
  prompt: string;
  cwd?: string;
  /** Used to register the spawn'd subprocess so it can be cancelled. */
  jobId?: number;
  /** Extra env vars merged on top of process.env for the subprocess. */
  env?: Record<string, string>;
  /** Called for every line of stdout/stderr after stream-json parsing. */
  onLine?: (line: string, stream: "stdout" | "stderr") => void;
  signal?: AbortSignal;
}

export interface RunAgentResult {
  exitCode: number | null;
  cancelled: boolean;
}

const running = new Map<number, ChildProcess>();

function parseArgs(raw: string): string[] {
  return raw.trim().length === 0 ? [] : raw.trim().split(/\s+/);
}

export function cancelAgent(jobId: number): boolean {
  const child = running.get(jobId);
  if (!child) return false;
  child.kill("SIGTERM");
  // Hard kill if it doesn't exit in 3s.
  setTimeout(() => {
    if (running.has(jobId)) child.kill("SIGKILL");
  }, 3000);
  return true;
}

/**
 * Pull human-readable text from a single stream-json event from `claude --output-format stream-json`.
 * Returns null when there's nothing worth showing (e.g. session bookkeeping).
 */
function formatStreamEvent(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;
  const type = obj.type;
  if (type === "system") {
    if (obj.subtype === "init") {
      const tools = Array.isArray(obj.tools) ? obj.tools.length : "?";
      const mcp = Array.isArray(obj.mcp_servers)
        ? obj.mcp_servers.map((s: any) => `${s.name}:${s.status}`).join(", ")
        : "";
      return `session init — model=${obj.model ?? "?"} tools=${tools}${mcp ? ` mcp=[${mcp}]` : ""}`;
    }
    return null;
  }
  if (type === "assistant") {
    const content = obj.message?.content;
    if (!Array.isArray(content)) return null;
    const out: string[] = [];
    for (const c of content) {
      if (c.type === "text" && c.text) {
        const txt = String(c.text).trim();
        if (txt) out.push(txt);
      } else if (c.type === "tool_use") {
        const name = c.name ?? "?";
        const input = c.input ? JSON.stringify(c.input).slice(0, 240) : "";
        out.push(`→ ${name}(${input})`);
      }
    }
    return out.join("\n") || null;
  }
  if (type === "user") {
    const content = obj.message?.content;
    if (!Array.isArray(content)) return null;
    const out: string[] = [];
    for (const c of content) {
      if (c.type === "tool_result") {
        const text = typeof c.content === "string"
          ? c.content
          : Array.isArray(c.content)
            ? c.content.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join(" ")
            : "";
        const trimmed = String(text).trim().slice(0, 200);
        out.push(`  ${c.is_error ? "✗" : "✓"} ${trimmed}`);
      }
    }
    return out.join("\n") || null;
  }
  if (type === "result") {
    return `result: ${obj.subtype ?? "?"} (${obj.num_turns ?? "?"} turns, $${obj.total_cost_usd ?? 0})`;
  }
  return null;
}

export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const cmd = process.env.AGENT_CMD?.trim() || "claude";
  // Default flags. stream-json gives live event-per-line so the UI sees progress.
  const baseArgs = parseArgs(
    process.env.AGENT_ARGS ??
      "-p --chrome --dangerously-skip-permissions --output-format stream-json --verbose"
  );
  const args = [...baseArgs, opts.prompt];

  const child = spawn(cmd, args, {
    cwd: opts.cwd ?? process.cwd(),
    env: { ...process.env, ...(opts.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (opts.jobId !== undefined) running.set(opts.jobId, child);
  let cancelled = false;

  const onAbort = () => {
    cancelled = true;
    if (!child.killed) child.kill("SIGTERM");
  };
  if (opts.signal) opts.signal.addEventListener("abort", onAbort, { once: true });

  const lineBuf = { stdout: "", stderr: "" };
  const handleStdoutLine = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    // Stream-json: one JSON object per line. Fallback to raw when not JSON.
    let parsed: any = null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      opts.onLine?.(raw, "stdout");
      return;
    }
    const formatted = formatStreamEvent(parsed);
    if (formatted) {
      for (const line of formatted.split("\n")) opts.onLine?.(line, "stdout");
    }
  };

  const pipe = (chunk: Buffer, stream: "stdout" | "stderr") => {
    lineBuf[stream] += chunk.toString();
    let idx;
    while ((idx = lineBuf[stream].indexOf("\n")) !== -1) {
      const line = lineBuf[stream].slice(0, idx);
      lineBuf[stream] = lineBuf[stream].slice(idx + 1);
      if (stream === "stdout") handleStdoutLine(line);
      else opts.onLine?.(line, "stderr");
    }
  };

  child.stdout?.on("data", (c) => pipe(c, "stdout"));
  child.stderr?.on("data", (c) => pipe(c, "stderr"));

  return new Promise((resolve, reject) => {
    child.on("error", (err) => {
      if (opts.jobId !== undefined) running.delete(opts.jobId);
      opts.signal?.removeEventListener("abort", onAbort);
      reject(err);
    });
    child.on("close", (code, signal) => {
      if (opts.jobId !== undefined) running.delete(opts.jobId);
      opts.signal?.removeEventListener("abort", onAbort);
      // Flush trailing partial lines.
      if (lineBuf.stdout) handleStdoutLine(lineBuf.stdout);
      if (lineBuf.stderr) opts.onLine?.(lineBuf.stderr, "stderr");
      resolve({
        exitCode: code,
        cancelled: cancelled || signal === "SIGTERM" || signal === "SIGKILL",
      });
    });
  });
}
