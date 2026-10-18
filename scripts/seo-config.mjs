import { siteOrigin, DEFAULT_SITE_URL } from '../src/seo/model.js';

export function seoBuildConfig(env) {
  const siteUrl = siteOrigin(env.VITE_SITE_URL || DEFAULT_SITE_URL);
  const productionHost = env.VERCEL_PROJECT_PRODUCTION_URL;
  const indexable = env.VITE_SEO_INDEXING !== 'false'
    && !['preview', 'development'].includes(env.VERCEL_ENV)
    && (!productionHost || productionHost === new URL(siteUrl).host);
  return { siteUrl, indexable, mode: env.VITE_DATA_MODE || 'demo' };
}
