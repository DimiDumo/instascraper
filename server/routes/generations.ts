import { Hono } from "hono";
import {
  getArtistByUsername,
  getPrompt,
  listGenerationsByArtist,
  createGeneration,
  editGenerationOutput,
  deleteGeneration,
  getGeneration,
} from "../../src/db";
import { runGeneration } from "../../src/services/generate";

export const generationsRoute = new Hono();

// GET /api/generations/by-artist/:username — list generations for one artist
generationsRoute.get("/by-artist/:username", (c) => {
  const artist = getArtistByUsername(c.req.param("username"));
  if (!artist) return c.json({ error: "artist not found" }, 404);
  return c.json({ rows: listGenerationsByArtist(artist.id) });
});

// POST /api/generations  { username, promptId } — kick off a new generation
generationsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = (body?.username as string | undefined)?.trim();
  const promptId = Number(body?.promptId);
  if (!username || !Number.isFinite(promptId)) {
    return c.json({ error: "username and promptId required" }, 400);
  }
  const artist = getArtistByUsername(username);
  if (!artist) return c.json({ error: "artist not found" }, 404);
  const prompt = getPrompt(promptId);
  if (!prompt) return c.json({ error: "prompt not found" }, 404);

  const row = createGeneration({
    artistId: artist.id,
    promptId: prompt.id,
    promptName: prompt.name,
    output: "",
    originalOutput: "",
    status: "running",
  });

  // fire-and-forget — runGeneration writes back via updateGeneration
  void runGeneration({
    artistUsername: artist.username,
    promptId: prompt.id,
    generationId: row.id,
  });

  return c.json(row);
});

// GET /api/generations/:id — useful for polling
generationsRoute.get("/:id", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const row = getGeneration(id);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

// PATCH /api/generations/:id  { output } — save user edits
generationsRoute.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const body = await c.req.json().catch(() => ({}));
  if (typeof body?.output !== "string") return c.json({ error: "output required" }, 400);
  const row = editGenerationOutput(id, body.output);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

generationsRoute.delete("/:id", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  deleteGeneration(id);
  return c.json({ ok: true });
});
