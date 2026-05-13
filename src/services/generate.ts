import * as cloud from "../cloud/client";
import { downloadToTmp } from "../cloud/r2";

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const TIMEOUT_MS = 180_000;
const CLEANUP_TIMEOUT_MS = 90_000;
const MAX_POSTS = 10;

async function imagePathForKey(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  try {
    return await downloadToTmp(key);
  } catch (err) {
    console.warn(`[generate] failed to download ${key}:`, err);
    return null;
  }
}

async function buildPromptInput(artist: any, promptBody: string): Promise<string> {
  const lines: string[] = [];
  lines.push(promptBody.trim());
  lines.push("");
  lines.push("---");
  lines.push("ARTIST CONTEXT");
  lines.push(`Username: @${artist.username}`);
  if (artist.fullName) lines.push(`Full name: ${artist.fullName}`);
  if (artist.bio) lines.push(`Bio: ${String(artist.bio).replace(/\n/g, " ")}`);
  lines.push(
    `Followers: ${artist.followersCount ?? "?"}  Following: ${artist.followingCount ?? "?"}  Posts: ${artist.postsCount ?? "?"}`,
  );
  lines.push("");

  const recent = ((artist.posts ?? []) as any[]).slice(0, MAX_POSTS);
  if (recent.length > 0) {
    lines.push(`RECENT POSTS (top ${recent.length} by postedAt):`);
    for (let i = 0; i < recent.length; i++) {
      const post = recent[i];
      const caption = (post.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
      lines.push(
        `${i + 1}. shortcode=${post.shortcode} likes=${post.likesCount ?? "?"} comments=${post.commentsCount ?? "?"}`,
      );
      if (caption) lines.push(`   caption: "${caption}"`);
      const imgKeys = [post.imageKey, ...((post.images ?? []) as any[]).map((img) => img.r2Key)]
        .filter((k): k is string => Boolean(k));
      const tmpPaths = (await Promise.all(imgKeys.map(imagePathForKey))).filter(
        (p): p is string => Boolean(p),
      );
      if (tmpPaths.length > 0) lines.push(`   images: ${tmpPaths.join(", ")}`);
    }
    lines.push("");
    lines.push(
      "Use the Read tool to inspect any image paths above so you can reference what the artwork actually shows.",
    );
  }

  lines.push("");
  lines.push("Return ONLY the DM text — no preamble, no explanation, no quotes.");
  return lines.join("\n");
}

async function runCleanupPass(rawDm: string): Promise<string | null> {
  const cleanup = (await cloud.prompts.list("cleanup")).rows[0];
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
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  );
  proc.stdin.write(input);
  await proc.stdin.end();

  const timeout = setTimeout(() => {
    try {
      proc.kill();
    } catch {
      /* ignore */
    }
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

export async function runPromptAgainstArtist(opts: {
  artistUsername: string;
  promptBody: string;
}): Promise<{ output: string; originalOutput: string }> {
  const artist = await cloud.artists.detail(opts.artistUsername).catch(() => null);
  if (!artist) throw new Error(`artist not found: ${opts.artistUsername}`);

  const input = await buildPromptInput(artist, opts.promptBody);

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
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
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
      throw new Error(stderr.trim() || `claude exited with code ${exitCode}`);
    }
    const rawOutput = stdout.trim();
    if (!rawOutput) throw new Error(stderr.trim() || "empty output");

    const cleaned = await runCleanupPass(rawOutput);
    return { output: cleaned ?? rawOutput, originalOutput: rawOutput };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export async function runGeneration(opts: {
  artistUsername: string;
  promptId: number;
  generationId: number;
}): Promise<void> {
  const { artistUsername, promptId, generationId } = opts;

  const prompt = await cloud.prompts.get(promptId).catch(() => null);
  if (!prompt) {
    await cloud.generations.patch(generationId, {
      status: "failed",
      errorMessage: `prompt not found: ${promptId}`,
    });
    return;
  }

  try {
    const { output, originalOutput } = await runPromptAgainstArtist({
      artistUsername,
      promptBody: prompt.body,
    });
    await cloud.generations.patch(generationId, {
      status: "done",
      output,
      originalOutput,
      model: "claude-code",
    });
  } catch (err) {
    await cloud.generations.patch(generationId, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
