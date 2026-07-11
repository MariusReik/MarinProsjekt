import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Spring Boot API (issues #7/#8) has no CORS config on its REST endpoints,
// and adding global CORS there is intentionally deferred until auth lands
// (backlog #21). Instead we proxy same-origin paths from the Vite dev server to
// the API, so the browser only ever talks to one origin in dev. In production
// the built assets are served behind the same reverse proxy as the API (week 7
// deploy), so the same relative paths keep working.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      // STOMP-over-WebSocket endpoint from issue #8.
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
