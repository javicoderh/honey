import { build, createServer, loadEnv } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { seoBuildConfig } from './seo-config.mjs';
import { getRouteSeo, renderHead, renderSitemap, safeJson } from '../src/seo/model.js';

// Sólo se serializa el catálogo público; nunca clientes, sesiones ni variables privadas.
export function publicCatalog(input) {
  if (!Array.isArray(input) || !input.length) throw new Error('El catálogo público está vacío o no es válido.');
  const seen = new Set();
  return input.map(product => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) || seen.has(product.slug) || typeof product.name !== 'string' || !Array.isArray(product.sizes) || !product.sizes.length) throw new Error('Producto no válido para prerenderizar.');
    seen.add(product.slug);
    const sizes = product.sizes.map(size => {
      if (typeof size.label !== 'string' || !Number.isSafeInteger(size.price) || size.price <= 0) throw new Error('Formato o precio no válido para prerenderizar.');
      return { label: size.label, price: size.price, ...(size.featured ? { featured: true } : {}) };
    });
    return { slug: product.slug, name: product.name, eyebrow: String(product.eyebrow ?? ''), summary: String(product.summary ?? ''), description: String(product.description ?? ''), color: String(product.color ?? '#b96b27'), accent: String(product.accent ?? '#f9e1c3'), notes: Array.isArray(product.notes) ? product.notes.map(String) : [], sizes };
  });
}

export async function buildSite() {
  const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
  const config = seoBuildConfig(env);
  let products;
  if (config.mode === 'api') {
    // Consulta pública de solo lectura. Un fallo detiene el deploy, no publica precios demo.
    const source = env.SEO_CATALOG_SOURCE || `${config.siteUrl}/api?route=catalog`;
    const response = await fetch(source, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`No se pudo consultar el catálogo público para SEO (${response.status}).`);
    products = publicCatalog(await response.json());
  } else {
    products = publicCatalog((await import('../src/data/products.js')).products);
  }
  await build();
  const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true, watch: null, hmr: false } });
  try {
    const { renderPage } = await server.ssrLoadModule('/src/seo/render.jsx');
    const template = await readFile('dist/index.html', 'utf8');
    const options = { products, siteUrl: config.siteUrl, indexing: config.indexable && config.mode === 'api' };
    const paths = ['/', '/productos', ...products.map(product => `/productos/${product.slug}`), '/nosotros', '/contacto', '/carrito', '/checkout', '/checkout/resultado', '/staff'];
    const metadata = [];
    const writePage = async (pathname, filename) => {
      const seo = getRouteSeo(pathname, options);
      const markup = renderPage(pathname, products);
      const html = template
        .replace(/<!--seo-head-start-->[\s\S]*?<!--seo-head-end-->/, () => renderHead(seo))
        .replace('<div id="root"></div>', () => `<div id="root">${markup}</div>\n    <script id="initial-catalog" type="application/json">${safeJson(products)}</script>`);
      await mkdir(dirname(filename), { recursive: true });
      await writeFile(filename, html);
      return seo;
    };
    for (const pathname of paths) metadata.push(await writePage(pathname, resolve('dist', pathname === '/' ? 'index.html' : `${pathname.slice(1)}.html`)));
    await writePage('/staff', resolve('dist/private.html'));
    await writePage('/404', resolve('dist/404.html'));
    await writeFile('dist/sitemap.xml', renderSitemap(metadata));
    // Las rutas noindex siguen rastreables: el robot debe poder leer la directiva.
    await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nDisallow: /api\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
    console.log(`SEO: ${paths.length} páginas prerenderizadas, ${metadata.filter(page => page.index).length} URLs en sitemap; canonical ${config.siteUrl}.`);
  } finally { await server.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildSite();
