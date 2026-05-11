import { resolve } from "node:path";
import { getActiveCleanupPrompt, getArtistDetail, getPrompt, updateGeneration } from "../db";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const TIMEOUT_MS = 180_000;
const CLEANUP_TIMEOUT_MS = 90_000;
const MAX_POSTS = 10;

function absImagePath(localPath: string | null): string | null {
  if (!localPath) return null;
  if (localPath.startsWith("/")) return localPath;
  return resolve(REPO_ROOT, localPath.replace(/^\.\//, ""));
}

function buildPromptInput(artist: NonNullable<ReturnType<typeof getArtistDetail>>, promptBody: string): string {
  const lines: string[] = [];
  lines.push(promptBody.trim());
  lines.push("");
  lines.push("---");
  lines.push("ARTIST CONTEXT");
  lines.push(`Username: @${artist.username}`);
  if (artist.fullName) lines.push(`Full name: ${artist.fullName}`);
  if (artist.bio) lines.push(`Bio: ${artist.bio.replace(/\n/g, " ")}`);
  lines.push(
    `Followers: ${artist.followersCount ?? "?"}  Following: ${artist.followingCount ?? "?"}  Posts: ${artist.postsCount ?? "?"}`
  );
  lines.push("");

  const recent = (artist.posts ?? []).slice(0, MAX_POSTS);
  if (recent.length > 0) {
    lines.push(`RECENT POSTS (top ${recent.length} by postedAt):`);
    recent.forEach((post, i) => {
      const caption = (post.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
      lines.push(
        `${i + 1}. shortcode=${post.shortcode} likes=${post.likesCount ?? "?"} comments=${post.commentsCount ?? "?"}`
      );
      if (caption) lines.push(`   caption: "${caption}"`);
      const imgs = (post.images ?? [])
        .map((img) => absImagePath(img.localPath))
        .filter((p): p is string => Boolean(p));
      if (imgs.length > 0) lines.push(`   images: ${imgs.join(", ")}`);
    });
    lines.push("");
    lines.push(
      "Use the Read tool to inspect any image paths above so you can reference what the artwork actually shows."
    );
  }

  lines.push("");
  lines.push("Return ONLY the DM text — no preamble, no explanation, no quotes.");
  return lines.join("\n");
}

async function runCleanupPass(rawDm: string): Promise<string | null> {
  const cleanup = getActiveCleanupPrompt();
  if (!cleanup) return null;

  const input = [
    cleanup.body.trim(),
    "",
    "---",
    "DM TO CLEAN:",
    '"""',
    rawDm,
    '"""',
    "",
    "Return ONLY the cleaned DM text. No preamble, no explanation, no quotes.",
  ].join("\n");

  const proc = Bun.spawn(
    [CLAUDE_BIN, "-p", "--permission-mode", "acceptEdits", "--output-format", "text"],
    { cwd: REPO_ROOT, stdin: "pipe", stdout: "pipe", stderr: "pipe" }
  );
  proc.stdin.write(input);
  await proc.stdin.end();

  const timeout = setTimeout(() => {
    try { proc.kill(); } catch { /* ignore */ }
  }, CLEANUP_TIMEOUT_MS);

  try {
    const [stdout, , exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    clearTimeout(timeout);
    if (exitCode !== 0) return null;
    const out = stdout.trim().replace(/^"""\n?|\n?"""$/g, "").trim();
    return out || null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function runGeneration(opts: {
  artistUsername: string;
  promptId: number;
  generationId: number;
}): Promise<void> {
  const { artistUsername, promptId, generationId } = opts;

  const artist = getArtistDetail(artistUsername);
  if (!artist) {
    updateGeneration(generationId, {
      status: "failed",
      errorMessage: `artist not found: ${artistUsername}`,
    });
    return;
  }
  const prompt = getPrompt(promptId);
  if (!prompt) {
    updateGeneration(generationId, {
      status: "failed",
      errorMessage: `prompt not found: ${promptId}`,
    });
    return;
  }

  const input = buildPromptInput(artist, prompt.body);

  const proc = Bun.spawn(
    [
      CLAUDE_BIN,
      "-p",
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      "Read",
      "--output-format",
      "text",
    ],
    {
      cwd: REPO_ROOT,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  proc.stdin.write(input);
  await proc.stdin.end();

  const timeout = setTimeout(() => {
    try {
      proc.kill();
    } catch {
      /* ignore */
    }
  }, TIMEOUT_MS);

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    clearTimeout(timeout);

    if (exitCode !== 0) {
      updateGeneration(generationId, {
        status: "failed",
        errorMessage: stderr.trim() || `claude exited with code ${exitCode}`,
      });
      return;
    }

    const rawOutput = stdout.trim();
    if (!rawOutput) {
      updateGeneration(generationId, {
        status: "failed",
        errorMessage: stderr.trim() || "empty output",
      });
      return;
    }

    // Auto-chain: run latest cleanup prompt over the raw DM. Falls back to raw if cleanup fails.
    const cleaned = await runCleanupPass(rawOutput);

    updateGeneration(generationId, {
      status: "done",
      output: cleaned ?? rawOutput,
      originalOutput: rawOutput,
      model: "claude-code",
    });
  } catch (err) {
    clearTimeout(timeout);
    updateGeneration(generationId, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
