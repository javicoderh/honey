import { defineConfig, loadEnv } from "vite";
import { seoBuildConfig } from "./scripts/seo-config.mjs";

export default defineConfig(({ mode }) => {
  const seo = seoBuildConfig({ ...loadEnv(mode, process.cwd(), ''), ...process.env });
  return {
  appType: "spa",
  define: {
    'import.meta.env.VITE_SITE_URL': JSON.stringify(seo.siteUrl),
    'import.meta.env.VITE_SEO_INDEXING': JSON.stringify(String(seo.indexable)),
  },
  server: {
    proxy: { '/api': 'http://127.0.0.1:3001' },
    watch: {
      // Los perfiles del navegador contienen archivos bloqueados en Windows.
      ignored: ["**/.preview-browser/**", "**/.npm-cache/**", "**/.pnpm-store/**"],
    },
  },
  };
});
