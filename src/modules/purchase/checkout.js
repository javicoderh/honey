import { isValidEmail, isValidPhone, textValue } from "../../shared/validation.js";

// Condiciones ficticias para recorrer el flujo. No representan cobertura comercial.
export const DEMO_SHIPPING_FEE = 3000;

export function validateCheckout(draft = {}) {
  draft = draft ?? {};
  const errors = {};
  for (const [group, keys] of [["buyer", ["name", "email", "phone"]], ["shippingAddress", ["street", "commune"]], ...(!draft.recipientSameAsBuyer ? [["recipient", ["name", "phone"]]] : [])]) {
    for (const key of keys) if (!textValue(draft[group]?.[key])) errors[`${group}.${key}`] = "Completa este campo.";
  }
  if (!errors["buyer.email"] && !isValidEmail(draft.buyer?.email)) errors["buyer.email"] = "Ingresa un correo válido, por ejemplo nombre@dominio.cl.";
  for (const group of draft.recipientSameAsBuyer ? ["buyer"] : ["buyer", "recipient"]) {
    if (!errors[`${group}.phone`] && !isValidPhone(draft[group]?.phone)) errors[`${group}.phone`] = "Ingresa un teléfono con 8 a 15 dígitos. Puedes usar +, espacios, guiones y paréntesis.";
  }
  return errors;
}
