import { sanitizeCart } from "./model.js";

export const CART_STORAGE_KEY = "casa-miel.cart.v1";

export function browserCartStorage() {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

export function readCart(storage) {
  try {
    if (!storage) return { lines: [], loadError: null };
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (!raw) return { lines: [], loadError: null };
    const saved = JSON.parse(raw);
    if (saved.version !== 1) throw new Error("Versión de carrito no compatible");
    return { lines: sanitizeCart(saved.lines), loadError: null };
  } catch {
    return { lines: [], loadError: "No pudimos recuperar el carrito anterior. Puedes agregar tus productos nuevamente." };
  }
}

export function writeCart(storage, lines) {
  try {
    if (!storage) throw new Error("Almacenamiento no disponible");
    storage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, lines: sanitizeCart(lines) }));
    return null;
  } catch {
    return "El carrito funciona en esta sesión, pero no se pudo guardar para la próxima visita.";
  }
}
