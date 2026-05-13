import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppBindings } from "./types";
import { accessAuth } from "./middleware/access";
import { artistsRoute } from "./routes/artists";
import { postsRoute } from "./routes/posts";
import { tagsRoute } from "./routes/tags";
import { jobsRoute } from "./routes/jobs";
import { promptsRoute } from "./routes/prompts";
import { generationsRoute } from "./routes/generations";
import { imagesRoute } from "./routes/images";
import { hubspotRoute } from "./routes/hubspot";

const app = new Hono<AppBindings>();

// Cloudflare Access already enforces auth at the edge for the configured app domain.
// CORS still matters for browser requests originating from the Pages app domain.
app.use(
  "*",
  cors({
    origin: (origin) => origin,
    credentials: true,
    allowHeaders: ["Content-Type", "Cf-Access-Jwt-Assertion"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/api/health", (c) => c.json({ ok: true, mode: "cloud" }));

// Everything under /api/* requires a valid Access JWT.
app.use("/api/*", accessAuth);

app.route("/api/artists", artistsRoute);
app.route("/api/posts", postsRoute);
app.route("/api/tags", tagsRoute);
app.route("/api/jobs", jobsRoute);
app.route("/api/prompts", promptsRoute);
app.route("/api/generations", generationsRoute);
app.route("/api/images", imagesRoute);
app.route("/api/hubspot", hubspotRoute);

app.notFound((c) => c.json({ error: "not found" }, 404));

export default app;
