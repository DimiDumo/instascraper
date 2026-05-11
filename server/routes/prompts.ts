import { Hono } from "hono";
import { refinePrompt } from "../../src/services/refine";

// Local server keeps only the /refine route — it spawns a local subprocess
// (claude CLI) which would not work from inside a Cloudflare Worker.
export const promptsRoute = new Hono();

promptsRoute.post("/:id/refine", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const body = await c.req.json().catch(() => ({}));
  const generationId = Number(body?.generationId);
  const feedback = (body?.feedback as string | undefined)?.trim();
  if (!Number.isFinite(generationId) || !feedback) {
    return c.json({ error: "generationId and feedback required" }, 400);
  }
  const result = await refinePrompt({ promptId: id, generationId, feedback });
  if ("error" in result) return c.json({ error: result.error }, 500);
  return c.json(result);
});
