import { honeys } from '../data/honeyContent.js';

export const DEFAULT_SITE_URL = 'https://honey-d164.vercel.app';
export function siteOrigin(value = DEFAULT_SITE_URL) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('VITE_SITE_URL debe ser un origen público, sin ruta, parámetros ni credenciales.');
  return url.origin;
}
export const SITE_URL = siteOrigin(import.meta.env?.VITE_SITE_URL || DEFAULT_SITE_URL);
export const SEO_INDEXING = import.meta.env?.PROD === true && import.meta.env?.VITE_SEO_INDEXING !== 'false';
export const normalizePath = value => (value.split(/[?#]/)[0].replace(/\/+$/, '') || '/');
export const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const pages = {
  '/': { title: 'Casa Miel | Miel multifloral, de cerezo y de avellano', description: 'Descubre tres mieles en potes de 1 kg: multifloral de textura firme, cerezo y avellano cremosas. Elige tu favorita y compra sin crear una cuenta.', index: true },
  '/productos': { title: 'Mieles de 1 kg: elige tu favorita | Casa Miel', description: 'Compara miel multifloral, miel de cerezo y miel de avellano. Revisa texturas, formatos y precios para elegir la miel que va contigo.', index: true },
  '/nosotros': { title: 'Nuestro origen | Casa Miel', description: 'Conoce el proyecto Casa Miel y la información sobre el origen de sus productos.', index: false },
  '/contacto': { title: 'Contacto y preguntas frecuentes | Casa Miel', description: 'Información de contacto y ayuda para elegir tus productos en Casa Miel.', index: false },
  '/carrito': { title: 'Tu carrito | Casa Miel', description: 'Revisa tu selección antes de continuar con la compra.', index: false },
  '/checkout': { title: 'Datos de compra y entrega | Casa Miel', description: 'Completa tus datos y consulta el despacho de tu pedido.', index: false },
  '/checkout/resultado': { title: 'Estado de tu pedido | Casa Miel', description: 'Consulta de forma privada el estado de tu compra.', index: false },
};

export function getRouteSeo(path, { products = [], siteUrl = SITE_URL, indexing = SEO_INDEXING, offers = true } = {}) {
  const pathname = normalizePath(path);
  const origin = siteOrigin(siteUrl);
  const product = products.find(item => pathname === `/productos/${item.slug}`);
  const honey = product && honeys.find(item => item.slug === product.slug);
  const format = product?.sizes.find(size => size.featured) ?? product?.sizes[0];
  const isStaff = pathname === '/staff' || pathname.startsWith('/staff/');
  const page = product ? {
    title: `${product.name}${format ? ` ${format.label}` : ''} | Casa Miel`,
    description: honey ? `${product.name} de textura ${honey.texture === 'Dura' ? 'firme' : 'cremosa'}. ${honey.ritual} Revisa su formato y precio en Casa Miel.` : product.summary,
    index: Boolean(honey),
  } : pages[pathname] ?? (isStaff ? { title: 'Acceso del equipo | Casa Miel', description: 'Acceso privado de administración y entregas.', index: false } : { title: 'Página no encontrada | Casa Miel', description: 'Vuelve al catálogo para descubrir nuestras mieles.', index: false });
  const known = Boolean(product || pages[pathname] || isStaff);
  const isPrivate = isStaff || pathname === '/carrito' || pathname === '/checkout' || pathname.startsWith('/checkout/');
  const canonical = known && !isPrivate ? `${origin}${pathname === '/' ? '/' : pathname}` : null;
  const image = `${origin}${honey ? `/art/miel-${honey.id}.png` : '/art/jardin-de-miel.png'}`;
  const index = indexing && page.index;
  const graph = [];
  const organization = { '@type': 'Organization', '@id': `${origin}/#organization`, name: 'Casa Miel', url: `${origin}/` };
  if (index) {
    graph.push(organization);
    if (pathname === '/') graph.push({ '@type': 'WebSite', '@id': `${origin}/#website`, name: 'Casa Miel', url: `${origin}/`, inLanguage: 'es-CL', publisher: { '@id': organization['@id'] } });
    if (pathname === '/productos') graph.push({ '@type': 'CollectionPage', name: 'Mieles Casa Miel', url: canonical, inLanguage: 'es-CL', mainEntity: { '@type': 'ItemList', itemListElement: products.filter(item => honeys.some(h => h.slug === item.slug)).map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, url: `${origin}/productos/${item.slug}` })) } });
    if (product) graph.push({ '@type': 'Product', '@id': `${canonical}#product`, name: product.name, description: honey.description, image: [image], url: canonical, brand: { '@type': 'Brand', name: 'Casa Miel' }, ...(offers ? { offers: product.sizes.map(size => ({ '@type': 'Offer', name: `${product.name} · ${size.label}`, price: size.price, priceCurrency: 'CLP', url: canonical, seller: { '@id': organization['@id'] } })) } : {}) });
    if (pathname !== '/') graph.push({ '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: `${origin}/` }, { '@type': 'ListItem', position: 2, name: 'Productos', item: `${origin}/productos` }, ...(product ? [{ '@type': 'ListItem', position: 3, name: product.name, item: canonical }] : [])] });
  }
  return { ...page, pathname, canonical, image, imageAlt: honey ? `Ilustración de ${product.name.toLowerCase()}` : 'Jardín ilustrado de Casa Miel', robots: index ? 'index, follow, max-image-preview:large' : 'noindex, follow', index, jsonLd: graph.length ? { '@context': 'https://schema.org', '@graph': graph } : null };
}

export function renderHead(seo) {
  const meta = (key, value, property = false) => `<meta ${property ? 'property' : 'name'}="${key}" content="${escapeHtml(value)}" data-seo="true" />`;
  return [
    `<title data-seo="true">${escapeHtml(seo.title)}</title>`, meta('description', seo.description), meta('robots', seo.robots),
    seo.canonical ? `<link rel="canonical" href="${escapeHtml(seo.canonical)}" data-seo="true" />` : '',
    meta('og:type', 'website', true), meta('og:site_name', 'Casa Miel', true), meta('og:locale', 'es_CL', true),
    meta('og:title', seo.title, true), meta('og:description', seo.description, true), meta('og:image', seo.image, true), meta('og:image:alt', seo.imageAlt, true),
    seo.canonical ? meta('og:url', seo.canonical, true) : '', meta('twitter:card', 'summary_large_image'), meta('twitter:title', seo.title), meta('twitter:description', seo.description), meta('twitter:image', seo.image), meta('twitter:image:alt', seo.imageAlt),
    seo.jsonLd ? `<script type="application/ld+json" data-seo="true">${safeJson(seo.jsonLd)}</script>` : '',
  ].filter(Boolean).join('\n    ');
}

export function renderSitemap(routes) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.filter(route => route.index && route.canonical).map(route => `  <url><loc>${escapeHtml(route.canonical)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
