import { createDatabase } from '../server/supabase.mjs';
import { readConfig } from '../server/config.mjs';

const names = ['SUPABASE_URL','SUPABASE_SECRET_KEY','APP_ORIGIN','ORDER_ACCESS_SECRET'];
const missing = names.filter(name => !process.env[name]);
if (missing.length) { console.error(`Faltan variables: ${missing.join(', ')}. No se muestran ni solicitan valores privados.`); process.exitCode = 1; }
else {
  try {
    const db = createDatabase({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY });
    const catalog = await db.catalog();
    const session = await db.session('0'.repeat(64));
    if (session !== null || !catalog.length) throw Error('Revisa migración, catálogo y sesiones.');
    const config = readConfig();
    console.log(`Conexión y esquema accesibles. ${catalog.length} productos activos. Cobertura/tarifa: ${config.communes.length && config.shippingFee !== null ? 'configuradas' : 'pendientes; compras bloqueadas'}. No se modificaron datos.`);
  } catch { console.error('No se pudo comprobar el esquema y catálogo. Revisa configuración, migración y seed.'); process.exitCode = 1; }
}
