// Condiciones ficticias para recorrer el flujo. No representan cobertura comercial.
export const DEMO_SHIPPING_FEE = 3000;

export function validateCheckout(draft) {
  const errors = {};
  for (const [group, keys] of [["buyer", ["name", "email", "phone"]], ["shippingAddress", ["street", "commune"]], ...(!draft.recipientSameAsBuyer ? [["recipient", ["name", "phone"]]] : [])]) {
    for (const key of keys) if (!draft[group][key].trim()) errors[`${group}.${key}`] = "Completa este campo.";
  }
  if (draft.buyer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.buyer.email.trim())) errors["buyer.email"] = "Ingresa un correo válido.";
  for (const group of draft.recipientSameAsBuyer ? ["buyer"] : ["buyer", "recipient"]) {
    const phone = draft[group].phone;
    if (phone && !/^\+?[\d\s()-]{8,20}$/.test(phone.trim())) errors[`${group}.phone`] = "Ingresa un teléfono válido (8 a 20 caracteres).";
  }
  return errors;
}
