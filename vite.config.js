import { defineConfig } from "vite";

// Do not copy the legacy public/index.html placeholder into the auth test build.
export default defineConfig({
  publicDir: false,
  build: { outDir: "dist", emptyOutDir: true },
});
