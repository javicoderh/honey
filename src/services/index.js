import { createMockAdapter } from "./mock";

// Las pantallas consumen este contrato; la futura API reemplazará el adaptador.
export function createServices(adapter) {
  for (const [module, method] of [
    ["catalog", "list"], ["auth", "getSession"], ["orders", "list"], ["orders", "getById"],
    ["payments", "getForOrder"], ["staff", "list"],
    ["orders", "create"],
    ["orders", "update"],
    ["auth", "login"], ["auth", "logout"],
  ]) {
    if (typeof adapter?.[module]?.[method] !== "function") {
      throw new Error(`Falta el servicio ${module}.${method}`);
    }
  }
  if (adapter.mode === "demo" && typeof adapter.payments.simulate !== "function") throw new Error("Falta el servicio payments.simulate de demostración");
  return adapter;
}

export const services = createServices(createMockAdapter());
