import { requiredText } from "../../shared/domain.js";

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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Correo inválido");
  return {
    buyer: { name: requiredText(draft.buyer.name, "Comprador"), email, phone: requiredText(draft.buyer.phone, "Teléfono del comprador") },
    recipient: { name: requiredText(recipient.name, "Destinatario"), phone: requiredText(recipient.phone, "Teléfono del destinatario") },
    shippingAddress: {
      street: requiredText(draft.shippingAddress.street, "Dirección"),
      commune: requiredText(draft.shippingAddress.commune, "Comuna"),
      apartment: (draft.shippingAddress.apartment ?? "").trim(),
      reference: (draft.shippingAddress.reference ?? "").trim(),
    },
    deliveryInstructions: (draft.deliveryInstructions ?? "").trim(),
  };
}
