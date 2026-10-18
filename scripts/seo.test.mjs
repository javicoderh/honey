import test from 'node:test';
import assert from 'node:assert/strict';
import { getRouteSeo, renderHead, renderSitemap, safeJson, siteOrigin } from '../src/seo/model.js';
import { seoBuildConfig } from './seo-config.mjs';
import { publicCatalog } from './build-seo.mjs';
import { products } from '../src/data/products.js';

const options = { products, indexing: true, siteUrl: 'https://tienda.example' };
test('canonical omite seguimiento, fragmentos y barras finales', () => {
  assert.equal(getRouteSeo('/productos/miel-de-cerezo/?utm_source=test#detalle', options).canonical, 'https://tienda.example/productos/miel-de-cerezo');
  assert.equal(getRouteSeo('/', options).canonical, 'https://tienda.example/');
});
test('rutas privadas, incompletas y desconocidas nunca se indexan', () => {
  for (const path of ['/carrito', '/checkout', '/checkout/resultado#pedido=privado', '/staff', '/staff/admin/pedidos/id', '/nosotros', '/contacto', '/productos/polen-apicola', '/productos/no-existe', '/no-existe']) {
    const seo = getRouteSeo(path, options);
    assert.equal(seo.index, false, path); assert.match(seo.robots, /noindex/); assert.equal(seo.jsonLd, null);
  }
  assert.equal(getRouteSeo('/checkout/resultado#pedido=secreto', options).canonical, null);
});
test('Product usa los precios vigentes y no inventa disponibilidad ni reseñas', () => {
  const updated = products.map(product => product.slug === 'miel-de-cerezo' ? { ...product, sizes: [{ label: '1 kg', price: 12345 }] } : product);
  const seo = getRouteSeo('/productos/miel-de-cerezo', { ...options, products: updated });
  const product = seo.jsonLd['@graph'].find(item => item['@type'] === 'Product');
  assert.equal(product.offers[0].price, 12345); assert.equal(product.offers[0].priceCurrency, 'CLP');
  for (const field of ['aggregateRating', 'review', 'sku', 'gtin', 'availability']) assert.equal(field in product, false);
  assert.equal('availability' in product.offers[0], false);
  assert.equal('shippingDetails' in product.offers[0], false);
});
test('sitemap sólo incluye las cinco rutas comerciales canónicas', () => {
  const paths = ['/', '/productos', '/nosotros', '/contacto', '/carrito', '/staff', ...products.map(product => `/productos/${product.slug}`)];
  const sitemap = renderSitemap(paths.map(path => getRouteSeo(path, options)));
  assert.equal((sitemap.match(/<loc>/g) || []).length, 5);
  assert.doesNotMatch(sitemap, /staff|checkout|carrito|contacto|nosotros|polen|lastmod/);
});
test('previews, segundo dominio y desactivación explícita quedan noindex', () => {
  assert.equal(seoBuildConfig({ VERCEL_ENV: 'preview' }).indexable, false);
  assert.equal(seoBuildConfig({ VITE_SEO_INDEXING: 'false' }).indexable, false);
  assert.equal(seoBuildConfig({ VERCEL_PROJECT_PRODUCTION_URL: 'honey-theta-five.vercel.app' }).indexable, false);
  assert.equal(seoBuildConfig({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'honey-d164.vercel.app' }).indexable, true);
  assert.equal(getRouteSeo('/', { ...options, indexing: false }).jsonLd, null);
});
test('head y catálogo neutralizan HTML y cierres de script', () => {
  const hostile = '</script><script>alert("x")</script>';
  assert.doesNotMatch(safeJson({ value: hostile }), /</);
  const seo = getRouteSeo('/productos/miel-de-cerezo', { ...options, products: products.map(product => ({ ...product, name: hostile })) });
  const head = renderHead(seo);
  assert.doesNotMatch(head, /<script>alert/);
  assert.match(head, /&lt;\/script&gt;/);
});
test('el catálogo de prerender excluye campos ajenos y valida rutas y precios', () => {
  const clean = publicCatalog([{ ...products[0], secret: 'private', customers: ['private'] }]);
  assert.equal('secret' in clean[0], false); assert.equal('customers' in clean[0], false);
  assert.throws(() => publicCatalog([{ ...products[0], slug: '../index' }]));
  assert.throws(() => publicCatalog([{ ...products[0], sizes: [{ label: '1 kg', price: -1 }] }]));
  assert.throws(() => publicCatalog([products[0], products[0]]));
  assert.throws(() => siteOrigin('https://name:secret@example.com'));
  assert.throws(() => siteOrigin('https://example.com/subpath'));
});
