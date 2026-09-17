import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  root: "apps/web",
  base: mode === "pages" ? "/clockwork-rivals/" : "/",
  publicDir: "public",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/matchmake": "http://127.0.0.1:2567",
      "/api": "http://127.0.0.1:2567",
      "/socket": {
        target: "ws://127.0.0.1:2567",
        ws: true,
        rewrite: (p) => p.replace(/^\/socket/, ""),
      },
    },
  },
  build: {
    outDir: mode === "pages" ? "../../dist/pages" : "../../dist/web",
    emptyOutDir: true,
  },
}));
