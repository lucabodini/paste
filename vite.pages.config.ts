import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: path.resolve(__dirname, "github-pages"),
  base: "/paste/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  build: {
    outDir: path.resolve(__dirname, "github-pages-dist"),
    emptyOutDir: true,
  },
});
