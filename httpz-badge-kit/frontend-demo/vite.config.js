import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  server: {
    port: 5173,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp"
    },
    fs: {
      allow: [path.resolve(__dirname, "..")]
    }
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared")
    }
  }
});
