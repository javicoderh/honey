import { createMockAdapter } from "./mock";
import { createHttpAdapter } from "./http.js";

// Las pantallas consumen este contrato; la futura API reemplazará el adaptador.
export function createServices(adapter) {
  for (const [module, method] of [
    ["catalog", "list"], ["auth", "getSession"], ["orders", "list"], ["orders", "getById"],
    ["payments", "getForOrder"], ["staff", "list"],
    ["orders", "create"],
    ["orders", "update"],
    ["orders", "listAssigned"],
    ["auth", "login"], ["auth", "logout"],
    ["staff", "create"], ["staff", "update"],
  ]) {
    if (typeof adapter?.[module]?.[method] !== "function") {
      throw new Error(`Falta el servicio ${module}.${method}`);
    }
  }
  if (adapter.mode === "demo" && typeof adapter.payments.simulate !== "function") throw new Error("Falta el servicio payments.simulate de demostración");
  if (adapter.mode === 'api') for (const [module, method] of [['payments','capabilities'],['payments','start'],['checkout','quote'],['orders','privateReference']]) {
    if (typeof adapter?.[module]?.[method] !== 'function') throw new Error(`Falta el servicio ${module}.${method} de API`);
  }
  return adapter;
}

const mode = import.meta.env?.VITE_DATA_MODE ?? 'demo';
if (!['demo', 'api'].includes(mode)) throw new Error('VITE_DATA_MODE debe ser demo o api');
export const services = createServices(mode === 'api' ? createHttpAdapter() : createMockAdapter());
