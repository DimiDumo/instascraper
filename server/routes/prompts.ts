import { Hono } from "hono";
import {
  listPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
  undoPrompt,
} from "../../src/db";
import { refinePrompt } from "../../src/services/refine";

export const promptsRoute = new Hono();

const KINDS = ["generate", "cleanup"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (v: unknown): v is Kind => typeof v === "string" && (KINDS as readonly string[]).includes(v);

promptsRoute.get("/", (c) => {
  const kindParam = c.req.query("kind");
  const kind = isKind(kindParam) ? kindParam : undefined;
  return c.json({ rows: listPrompts({ kind }) });
});

promptsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = (body?.name as string | undefined)?.trim();
  const promptBody = (body?.body as string | undefined)?.trim();
  const kind: Kind = isKind(body?.kind) ? body.kind : "generate";
  if (!name || !promptBody) return c.json({ error: "name and body required" }, 400);
  const prompt = createPrompt({ name, body: promptBody, kind });
  return c.json(prompt);
});

promptsRoute.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const body = await c.req.json().catch(() => ({}));
  const patch: { name?: string; body?: string; kind?: Kind } = {};
  if (typeof body?.name === "string") patch.name = body.name.trim();
  if (typeof body?.body === "string") patch.body = body.body;
  if (isKind(body?.kind)) patch.kind = body.kind;
  const prompt = updatePrompt(id, patch);
  if (!prompt) return c.json({ error: "not found" }, 404);
  return c.json(prompt);
});

promptsRoute.delete("/:id", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  deletePrompt(id);
  return c.json({ ok: true });
});

promptsRoute.get("/:id", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const prompt = getPrompt(id);
  if (!prompt) return c.json({ error: "not found" }, 404);
  return c.json(prompt);
});

// Refine the prompt body based on a generation result + user feedback.
// Blocking — waits for the claude subprocess to return the proposed new body.
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

// Restore previousBody if present; one-step undo
promptsRoute.post("/:id/undo", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const prompt = undoPrompt(id);
  if (!prompt) return c.json({ error: "no previous version" }, 404);
  return c.json(prompt);
});
