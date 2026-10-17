import { writeFile } from 'node:fs/promises';
import { products } from '../src/data/products.js';

const literal = value => `'${value.replaceAll("'", "''")}'`;
const sql = ['-- Catálogo inicial. Revisar precios y disponibilidad antes de activar ventas.', 'begin;', ...products.map(product => `insert into public.honey_catalog(slug,data) values (${literal(product.slug)},${literal(JSON.stringify(product))}::jsonb) on conflict(slug) do update set data=excluded.data;`), 'commit;', ''].join('\n');
await writeFile(new URL('../supabase/seed.sql', import.meta.url), sql);
console.log('Preparado supabase/seed.sql. No se ejecutaron cambios en una base de datos.');
