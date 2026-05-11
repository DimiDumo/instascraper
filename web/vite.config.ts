import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Web uses relative `/api/*` for cloud data calls. In dev we proxy it to the
// Cloudflare Worker and inject the Service Token headers so CF Access lets us
// through (browser at localhost:5173 has no CF Access cookie). In prod (web
// served from reo.gallerytalk.io) the Pages app and Worker share the origin so
// `/api/*` hits the Worker route directly — no proxy needed.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rootEnv = loadEnv(mode, "..", "");
  const target = env.VITE_CLOUD_API_URL || "https://reo.gallerytalk.io";
  const clientId = rootEnv.CF_ACCESS_CLIENT_ID || env.CF_ACCESS_CLIENT_ID || "";
  const clientSecret = rootEnv.CF_ACCESS_CLIENT_SECRET || env.CF_ACCESS_CLIENT_SECRET || "";

  return {
    plugins: [react()],
    server: {
      port: Number(process.env.WEB_PORT ?? 5173),
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (clientId) proxyReq.setHeader("CF-Access-Client-Id", clientId);
              if (clientSecret) proxyReq.setHeader("CF-Access-Client-Secret", clientSecret);
            });
          },
        },
      },
    },
  };
});
