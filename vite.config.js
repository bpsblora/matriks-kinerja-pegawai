import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  publicDir: "assets",
  base: process.env.GITHUB_PAGES === "true" ? "/matriks-kinerja-pegawai/" : "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url))
      }
    }
  }
});
