import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

import { artistsRoute } from "./routes/artists";
import { postsRoute } from "./routes/posts";
import { tagsRoute } from "./routes/tags";
import { jobsRoute } from "./routes/jobs";
import { logsRoute } from "./routes/logs";
import { subscribe } from "./services/events";

const app = new Hono();

const repoRoot = resolve(import.meta.dir, "..");
const imagesDir = resolve(repoRoot, "data", "images");
const webDist = resolve(repoRoot, "web", "dist");

app.use("*", async (c, next) => {
  await next();
  c.header("Access-Control-Allow-Origin", "*");
});

app.route("/api/artists", artistsRoute);
app.route("/api/posts", postsRoute);
app.route("/api/tags", tagsRoute);
app.route("/api/jobs", jobsRoute);
app.route("/api/logs", logsRoute);

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/events/jobs", (c) => {
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };
      send({ type: "hello" });
      const unsub = subscribe((event) => send(event));
      const ping = setInterval(() => {
        try {
          controller.enqueue(`: ping\n\n`);
        } catch {
          /* closed */
        }
      }, 25_000);
      const close = () => {
        clearInterval(ping);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      c.req.raw.signal.addEventListener("abort", close, { once: true });
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});

// Serve images directly from data/images/
app.get("/images/*", (c) => {
  const rel = c.req.path.replace(/^\/images\//, "");
  const safe = rel.split("/").filter((seg) => seg && seg !== ".." && seg !== ".").join("/");
  const filePath = join(imagesDir, safe);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return c.text("not found", 404);
  }
  const file = Bun.file(filePath);
  return new Response(file);
});

// In production, serve built SPA
if (existsSync(webDist)) {
  app.use("/*", serveStatic({ root: "./web/dist" }));
  app.get("*", (c) => {
    const indexPath = resolve(webDist, "index.html");
    return new Response(Bun.file(indexPath), {
      headers: { "Content-Type": "text/html" },
    });
  });
}

const port = Number(process.env.API_PORT ?? 3737);
console.log(`[instascraper] http://localhost:${port}`);

export default {
  port,
  // Disable idle-timeout so SSE streams (/events/jobs) stay open.
  // Bun default is 10s and kills long-running scrape POST handlers too.
  idleTimeout: 0,
  fetch: app.fetch,
};
