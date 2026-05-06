import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.API_TARGET || "http://localhost:3737";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/events": { target: apiTarget, changeOrigin: true, ws: false },
      "/images": { target: apiTarget, changeOrigin: true },
    },
  },
});
