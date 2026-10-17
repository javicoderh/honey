import { createApplication } from '../server/application.mjs';
import { createDatabase } from '../server/supabase.mjs';
import { readConfig } from '../server/config.mjs';

export default async function handler(req, res) {
  try {
    const db = createDatabase({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY });
    const app = createApplication({ db, config: readConfig() });
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(',') : value);
    let body;
    if (!['GET','HEAD'].includes(req.method)) {
      if (req.body !== undefined) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      else { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > 32768) { res.statusCode = 413; res.end(); return; } chunks.push(chunk); } body = Buffer.concat(chunks).toString(); }
      if (Buffer.byteLength(body) > 32768) { res.statusCode = 413; res.end(); return; }
    }
    const response = await app(new Request(new URL(req.url, process.env.APP_ORIGIN), { method: req.method, headers, ...(body === undefined ? {} : { body }) }));
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(await response.text());
  } catch { res.statusCode = 503; res.setHeader('Cache-Control','no-store'); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ error: 'El backend todavía no está disponible.' })); }
}
