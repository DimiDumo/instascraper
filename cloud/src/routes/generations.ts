import { Hono } from "hono";
import type { AppBindings } from "../types";
import { makeDb } from "../db/client";
import {
  getArtistByUsername,
  listGenerationsByArtist,
  getGeneration,
  createGeneration,
  updateGeneration,
  editGenerationOutput,
  deleteGeneration,
} from "../db/queries";

export const generationsRoute = new Hono<AppBindings>();

// Generation kick-off (POST /) stays local — needs the agent subprocess.
// Cloud exposes only data-plane operations: create row, update row, fetch, delete.

generationsRoute.get("/by-artist/:username", async (c) => {
  const db = makeDb(c.env.DB);
  const artist = await getArtistByUsername(db, c.req.param("username"));
  if (!artist) return c.json({ error: "artist not found" }, 404);
  return c.json({ rows: await listGenerationsByArtist(db, artist.id) });
});

generationsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = (body?.username as string | undefined)?.trim();
  const promptId = Number(body?.promptId);
  const promptName = body?.promptName as string | undefined;
  if (!username || !Number.isFinite(promptId)) {
    return c.json({ error: "username and promptId required" }, 400);
  }
  const db = makeDb(c.env.DB);
  const artist = await getArtistByUsername(db, username);
  if (!artist) return c.json({ error: "artist not found" }, 404);
  const row = await createGeneration(db, {
    artistId: artist.id,
    promptId,
    promptName: promptName ?? null,
    output: "",
    originalOutput: "",
    status: "running",
  });
  return c.json(row);
});

generationsRoute.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const row = await getGeneration(makeDb(c.env.DB), id);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

generationsRoute.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const body = await c.req.json().catch(() => ({}));
  const db = makeDb(c.env.DB);
  // Two modes: { output } from user edits, or full patch from local server's runGeneration.
  if (typeof body?.output === "string" && Object.keys(body).length === 1) {
    const row = await editGenerationOutput(db, id, body.output);
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json(row);
  }
  const patch = { ...body };
  const row = await updateGeneration(db, id, patch);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

generationsRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  await deleteGeneration(makeDb(c.env.DB), id);
  return c.json({ ok: true });
});
