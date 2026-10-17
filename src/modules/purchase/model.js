import { requiredText } from "../../shared/domain.js";
import { isValidEmail, isValidPhone } from "../../shared/validation.js";

export function createPurchaseDraft() {
  return {
    buyer: { name: "", email: "", phone: "" },
    recipientSameAsBuyer: true,
    recipient: { name: "", phone: "" },
    shippingAddress: { street: "", commune: "", apartment: "", reference: "" },
    deliveryInstructions: "",
  };
}

export function updatePurchaseDraft(draft, changes) {
  return {
    buyer: { ...draft.buyer, ...changes.buyer },
    recipientSameAsBuyer: changes.recipientSameAsBuyer ?? draft.recipientSameAsBuyer,
    recipient: { ...draft.recipient, ...changes.recipient },
    shippingAddress: { ...draft.shippingAddress, ...changes.shippingAddress },
    deliveryInstructions: changes.deliveryInstructions ?? draft.deliveryInstructions,
  };
}

export function resolveRecipient(draft) {
  const source = draft.recipientSameAsBuyer ? draft.buyer : draft.recipient;
  return { name: source.name, phone: source.phone };
}

export function purchaseSnapshot(draft) {
  const recipient = resolveRecipient(draft);
  const email = requiredText(draft.buyer.email, "Correo");
  if (!isValidEmail(email)) throw new Error("Correo inválido");
  const buyerName = requiredText(draft.buyer.name, "Comprador");
  const recipientName = requiredText(recipient.name, "Destinatario");
  const buyerPhone = requiredText(draft.buyer.phone, "Teléfono del comprador");
  const recipientPhone = requiredText(recipient.phone, "Teléfono del destinatario");
  if (!isValidPhone(buyerPhone)) throw new Error("Teléfono del comprador inválido");
  if (!isValidPhone(recipientPhone)) throw new Error("Teléfono del destinatario inválido");
  return {
    buyer: { name: buyerName, email, phone: buyerPhone },
    recipient: { name: recipientName, phone: recipientPhone },
    shippingAddress: {
      street: requiredText(draft.shippingAddress.street, "Dirección"),
      commune: requiredText(draft.shippingAddress.commune, "Comuna"),
      apartment: (draft.shippingAddress.apartment ?? "").trim(),
      reference: (draft.shippingAddress.reference ?? "").trim(),
    },
    deliveryInstructions: (draft.deliveryInstructions ?? "").trim(),
  };
}
