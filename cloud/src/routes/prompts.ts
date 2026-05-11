import { Hono } from "hono";
import type { AppBindings } from "../types";
import { makeDb } from "../db/client";
import {
  listPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
  undoPrompt,
} from "../db/queries";

export const promptsRoute = new Hono<AppBindings>();

const KINDS = ["generate", "cleanup"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (v: unknown): v is Kind =>
  typeof v === "string" && (KINDS as readonly string[]).includes(v);

promptsRoute.get("/", async (c) => {
  const kindParam = c.req.query("kind");
  const kind = isKind(kindParam) ? kindParam : undefined;
  return c.json({ rows: await listPrompts(makeDb(c.env.DB), { kind }) });
});

promptsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = (body?.name as string | undefined)?.trim();
  const promptBody = (body?.body as string | undefined)?.trim();
  const kind: Kind = isKind(body?.kind) ? body.kind : "generate";
  if (!name || !promptBody) return c.json({ error: "name and body required" }, 400);
  const prompt = await createPrompt(makeDb(c.env.DB), { name, body: promptBody, kind });
  return c.json(prompt);
});

promptsRoute.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const prompt = await getPrompt(makeDb(c.env.DB), id);
  if (!prompt) return c.json({ error: "not found" }, 404);
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
  const prompt = await updatePrompt(makeDb(c.env.DB), id, patch);
  if (!prompt) return c.json({ error: "not found" }, 404);
  return c.json(prompt);
});

promptsRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  await deletePrompt(makeDb(c.env.DB), id);
  return c.json({ ok: true });
});

promptsRoute.post("/:id/undo", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const prompt = await undoPrompt(makeDb(c.env.DB), id);
  if (!prompt) return c.json({ error: "no previous version" }, 404);
  return c.json(prompt);
});
