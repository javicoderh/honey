import { defineConfig } from "vite";

export default defineConfig({
  appType: "spa",
  server: {
    watch: {
      // Los perfiles del navegador contienen archivos bloqueados en Windows.
      ignored: ["**/.preview-browser/**", "**/.npm-cache/**", "**/.pnpm-store/**"],
    },
  },
});
