import { Hono } from "hono";
import { getLogs } from "../services/log-buffer";

export const logsRoute = new Hono();

logsRoute.get("/:id", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "bad id" }, 400);
  return c.json({ jobId: id, lines: getLogs(id) });
});
