/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      // agent: false → a fresh connection per request; pooled keep-alive
      // sockets go stale when the backend dev server restarts and surface
      // as intermittent 502s on Windows.
      "/api": {
        target: "http://127.0.0.1:8000",
        agent: false,
      },
    },
  },
  test: {
    environment: "node",
  },
});
