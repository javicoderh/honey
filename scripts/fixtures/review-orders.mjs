import { products } from "../../src/data/products.js";
import { createOrder, recordPaymentUpdate, recordDeliveryUpdate, assignOrderDelivery, addOrderComment } from "../../src/modules/orders/model.js";

// Datos ficticios exclusivos de revisión. Nunca se cargan en el adaptador normal.
export function createReviewOrders(now = new Date().toISOString()) {
  const at = new Date(Date.parse(now) - 60000).toISOString();
  const admin = { id: "demo-admin", name: "Administración demo", role: "admin" };
  const courier = { id: "demo-delivery", name: "Delivery demo", role: "delivery", active: true };
  return [
    ["pending", "pending", "pending"],
    ["rejected", "rejected", "pending"],
    ["paid", "approved", "pending"],
    ["ready", "approved", "ready"],
    ["transit", "approved", "in_transit"],
    ["failed", "approved", "failed"],
    ["delivered", "approved", "delivered"],
  ].map(([id, payment, delivery], index) => {
    let order = { ...createOrder({ id: `review-${id}`, number: `REV-${index + 1}`, createdAt: at, shippingFee: 3000, catalog: products,
      items: [{ slug: "miel-multifloral", format: "1 kg", quantity: 1 }],
      draft: { buyer: { name: `Comprador de prueba ${index + 1}`, email: `${id}@example.com`, phone: "+56911111111" }, recipientSameAsBuyer: false,
        recipient: { name: `Destinatario de prueba ${index + 1}`, phone: "+56922222222" }, shippingAddress: { street: "Calle ficticia 123", commune: "Pucón", apartment: "Oficina 12", reference: "Entrada lateral junto al portón" },
        deliveryInstructions: "Llamar antes de llegar. Entregar solo a la persona indicada; no dejar en la calle." }
    }), isTest: true };
    if (payment !== "pending") order = recordPaymentUpdate(order, { paymentId: order.payments[0].id, status: payment, transactionId: `test-${id}`, author: admin, at });
    if (delivery !== "pending") {
      order = recordDeliveryUpdate(order, { status: "ready", author: admin, at });
      order = assignOrderDelivery(order, { assignee: courier, author: admin, at });
      if (delivery !== "ready") order = recordDeliveryUpdate(order, { status: delivery, author: courier, at, reason: delivery === "failed" ? "No había nadie para recibir. Coordinar otra visita." : "" });
    }
    return addOrderComment(order, { id: `review-comment-${id}`, text: "Comentario interno de prueba: confirmar horario con el destinatario.", author: admin, at });
  });
}
