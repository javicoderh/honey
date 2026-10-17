export const textValue = (value) => typeof value === "string" ? value.trim() : "";

// Correo habitual de formulario; no intenta cubrir direcciones RFC entrecomilladas.
export function isValidEmail(value) {
  const email = textValue(value);
  if (email.length > 254) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || !/^[a-z\d.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  const labels = domain.split(".");
  return labels.length >= 2 && labels.every(label => /^(?!-)[a-z\d-]{1,63}(?<!-)$/i.test(label)) && /^(?:[a-z]{2,63}|xn--[a-z\d-]+)$/i.test(labels.at(-1));
}

export function isValidPhone(value) {
  const phone = textValue(value);
  if (phone.length > 40 || !/^\+?[\d ()-]+$/.test(phone) || !/^\+?[\d(]/.test(phone) || !/[\d)]$/.test(phone)) return false;
  // Quitar pares simples evita aceptar paréntesis vacíos, anidados o incompletos.
  if (/[()]/.test(phone.replace(/\(\d+\)/g, ""))) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}
