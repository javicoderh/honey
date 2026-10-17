import { defineConfig } from "vite";

export default defineConfig({
  appType: "spa",
  server: {
    proxy: { '/api': 'http://127.0.0.1:3001' },
    watch: {
      // Los perfiles del navegador contienen archivos bloqueados en Windows.
      ignored: ["**/.preview-browser/**", "**/.npm-cache/**", "**/.pnpm-store/**"],
    },
  },
});
