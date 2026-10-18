import { build } from 'vite';
import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

try {
for (const mode of ['api', 'demo']) {
  await build({ define: { 'import.meta.env.VITE_DATA_MODE': JSON.stringify(mode) } });
  const files = (await readdir('dist/assets')).filter(path => path.endsWith('.js'));
  const code = (await Promise.all(files.map(path => readFile(`dist/assets/${path}`, 'utf8')))).join('');
  assert.equal(/MP_ACCESS_TOKEN|MP_WEBHOOK_SECRET|SUPABASE_SECRET_KEY|ORDER_ACCESS_SECRET/.test(code), false, 'El bundle no debe incluir configuración privada del servidor.');
  console.log(`Compilación ${mode}: correcta; sin referencias a variables privadas del servidor.`);
}
} finally {
  await build();
  console.log('Compilación final restaurada con la configuración del proyecto.');
}
