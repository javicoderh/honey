import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const files = [];
async function scan(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, item.name);
    if (item.isDirectory()) await scan(file);
    else if (item.name.endsWith('.html')) files.push(file);
  }
}
await scan('dist');
const canonicals = new Set();
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const head = html.split('</head>')[0];
  assert.equal((head.match(/<title\b/g) || []).length, 1, file);
  assert.equal((head.match(/name="description"/g) || []).length, 1, file);
  assert.equal((head.match(/name="robots"/g) || []).length, 1, file);
  assert.match(head, /property="og:image"/); assert.match(head, /name="twitter:card"/);
  assert.match(html, /<html lang="es-CL">/);
  if (!file.endsWith('private.html') && !file.endsWith('staff.html')) assert.match(html, /<h1\b/);
  const initial = /<script id="initial-catalog" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(initial, file); assert.ok(Array.isArray(JSON.parse(initial[1])));
  const ld = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(head);
  if (ld) JSON.parse(ld[1]);
  if (/content="index, follow/.test(head)) {
    const canonical = /rel="canonical" href="([^"]+)"/.exec(head)?.[1];
    assert.ok(canonical); assert.equal(canonicals.has(canonical), false); canonicals.add(canonical);
    assert.doesNotMatch(html.split('<script id="initial-catalog"')[0], /La ficha final|sujeto a validación|Compra de demostración|hola@example.com/);
  }
}
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
assert.equal((sitemap.match(/<loc>/g) || []).length, canonicals.size);
for (const canonical of canonicals) assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
const robots = await readFile('dist/robots.txt', 'utf8');
assert.match(robots, /Sitemap: https?:\/\//); assert.doesNotMatch(robots, /Disallow: \/(?:staff|checkout|carrito)/);
const vercel = JSON.parse(await readFile('vercel.json', 'utf8'));
assert.equal(vercel.cleanUrls, true); assert.equal(vercel.trailingSlash, false);
assert.equal(vercel.rewrites.some(rule => rule.source.startsWith('/productos')), false, 'Productos desconocidos deben responder 404');
assert.match(await readFile('dist/404.html', 'utf8'), /content="noindex, follow"/);
console.log(`SEO verificado: ${files.length} HTML con metadatos, contenido, catálogo público y ${canonicals.size} URLs indexables en sitemap.`);
