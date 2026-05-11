import { Hono } from "hono";
import * as cloud from "../../src/cloud/client";
import { runGeneration } from "../../src/services/generate";

// Local server only handles the POST kick-off: it creates the cloud row via the
// Worker API, then spawns a local claude subprocess that fills the row in.
// Read/edit/delete happen against the Worker directly from the web app.
export const generationsRoute = new Hono();

generationsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = (body?.username as string | undefined)?.trim();
  const promptId = Number(body?.promptId);
  if (!username || !Number.isFinite(promptId)) {
    return c.json({ error: "username and promptId required" }, 400);
  }
  const prompt = await cloud.prompts.get(promptId).catch(() => null);
  if (!prompt) return c.json({ error: "prompt not found" }, 404);

  const row = await cloud.generations.create({
    username,
    promptId,
    promptName: prompt.name,
  });

  // fire-and-forget — runGeneration writes back via cloud.generations.patch
  void runGeneration({
    artistUsername: username,
    promptId,
    generationId: row.id,
  });

  return c.json(row);
});
