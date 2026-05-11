import { Hono } from "hono";
import { cors } from "hono/cors";

import { jobsRoute } from "./routes/jobs";
import { logsRoute } from "./routes/logs";
import { promptsRoute } from "./routes/prompts";
import { generationsRoute } from "./routes/generations";
import { subscribe } from "./services/events";

const app = new Hono();

// CORS so the Pages-hosted web app + local dev (vite on :5173) can call this
// localhost server from a browser when the laptop is reachable. Echoes the
// request Origin and handles OPTIONS preflight via hono/cors middleware.
app.use(
  "*",
  cors({
    origin: (origin) => origin,
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

// Web polls this from any device to detect whether the laptop's scraper is
// reachable. Reachable → unlock scrape/generate buttons. Unreachable → cloud
// read-only mode.
app.get("/api/health", (c) => c.json({ ok: true, mode: "local-agent" }));

app.route("/api/jobs", jobsRoute);
app.route("/api/logs", logsRoute);
app.route("/api/prompts", promptsRoute);
app.route("/api/generations", generationsRoute);

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

const port = Number(process.env.API_PORT ?? 3737);
console.log(`[instascraper local-agent] http://localhost:${port}`);

export default {
  port,
  // Disable idle-timeout so SSE streams (/events/jobs) stay open.
  idleTimeout: 0,
  fetch: app.fetch,
};
