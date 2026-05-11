import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { artists as artistsTable } from "../db/schema";
import { getArtistDetail, getGeneration, getPrompt } from "../db";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const TIMEOUT_MS = 180_000;
const MAX_POSTS = 6;

function absImagePath(localPath: string | null): string | null {
  if (!localPath) return null;
  if (localPath.startsWith("/")) return localPath;
  return resolve(REPO_ROOT, localPath.replace(/^\.\//, ""));
}

function artistById(id: number) {
  return db.query.artists.findFirst({ where: eq(artistsTable.id, id) }).sync();
}

function buildArtistContext(artist: NonNullable<ReturnType<typeof getArtistDetail>>): string {
  const lines: string[] = [];
  lines.push(`@${artist.username}` + (artist.fullName ? ` (${artist.fullName})` : ""));
  if (artist.bio) lines.push(`Bio: ${artist.bio.replace(/\n/g, " ")}`);
  lines.push(`Followers: ${artist.followersCount ?? "?"}`);
  const recent = (artist.posts ?? []).slice(0, MAX_POSTS);
  if (recent.length > 0) {
    lines.push("Recent posts:");
    recent.forEach((post, i) => {
      const caption = (post.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
      lines.push(`${i + 1}. ${caption || "(no caption)"}`);
      const imgs = (post.images ?? [])
        .map((img) => absImagePath(img.localPath))
        .filter((p): p is string => Boolean(p));
      if (imgs.length > 0) lines.push(`   images: ${imgs.join(", ")}`);
    });
  }
  return lines.join("\n");
}

function buildMetaPrompt(opts: {
  currentBody: string;
  artistContext: string;
  output: string;
  feedback: string;
}): string {
  return [
    "You are improving a reusable prompt template that generates Instagram DMs for emerging artists.",
    "The template is later combined with any artist's data (bio, posts, captions, images) to produce a DM.",
    "",
    "CURRENT PROMPT TEMPLATE:",
    '"""',
    opts.currentBody.trim(),
    '"""',
    "",
    "WHEN RUN AGAINST THIS ARTIST:",
    opts.artistContext,
    "",
    "IT PRODUCED THIS DM:",
    '"""',
    opts.output.trim(),
    '"""',
    "",
    "USER FEEDBACK ON THAT DM:",
    opts.feedback.trim(),
    "",
    "Use the Read tool to look at any image paths above so you understand what the artwork actually shows.",
    "",
    "Now rewrite the PROMPT TEMPLATE so future generations against any artist will incorporate the user's feedback.",
    "Keep it general — do NOT bake in details specific to this one artist.",
    "Keep instructions concise and actionable.",
    "Return ONLY the new prompt template text. No preamble, no explanation, no quotes around it.",
  ].join("\n");
}

export async function refinePrompt(opts: {
  promptId: number;
  generationId: number;
  feedback: string;
}): Promise<{ proposedBody: string } | { error: string }> {
  const prompt = getPrompt(opts.promptId);
  if (!prompt) return { error: "prompt not found" };
  const generation = getGeneration(opts.generationId);
  if (!generation) return { error: "generation not found" };

  const artistRow = artistById(generation.artistId);
  if (!artistRow) return { error: "artist not found" };
  const artist = getArtistDetail(artistRow.username);
  if (!artist) return { error: "artist detail not found" };

  const meta = buildMetaPrompt({
    currentBody: prompt.body,
    artistContext: buildArtistContext(artist),
    output: generation.output,
    feedback: opts.feedback,
  });

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

  proc.stdin.write(meta);
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
      return { error: stderr.trim() || `claude exited with code ${exitCode}` };
    }
    const body = stdout.trim().replace(/^"""\n?|\n?"""$/g, "").trim();
    if (!body) return { error: stderr.trim() || "empty output" };
    return { proposedBody: body };
  } catch (err) {
    clearTimeout(timeout);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
