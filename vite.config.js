import { defineConfig } from "vite";

export default defineConfig({
  root: "./",
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    assetsInlineLimit: 4096
  },
  server: {
    port: 3000,
    open: false
  }
});
