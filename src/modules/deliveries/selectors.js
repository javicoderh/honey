import { currentPayment } from "../payments/model.js";
import { selectOrders } from "../orders/selectors.js";

export function selectAssignedOrders(orders, deliveryId) {
  if (!deliveryId) return [];
  return selectOrders(orders).filter((order) => order.delivery.assignedTo === deliveryId && currentPayment(order)?.status === "approved" && !order.cancelledAt && !order.archivedAt && !order.paymentReviewRequired);
}

// Proyección operativa: no entrega comprador, precios, importes ni datos de pagos.
export function deliveryView(order) {
  return {
    id: order.id, number: order.number,
    items: order.items.map(({ productSlug, name, format, quantity }) => ({ productSlug, name, format, quantity })),
    recipient: structuredClone(order.recipient), shippingAddress: structuredClone(order.shippingAddress),
    deliveryInstructions: order.deliveryInstructions, originalDeliveryInstructions: order.originalDeliveryInstructions ?? order.deliveryInstructions,
    delivery: structuredClone(order.delivery), comments: structuredClone(order.comments),
    history: structuredClone(order.history.filter((entry) => entry.action.startsWith("delivery.") || entry.action === "comment.added")),
    createdAt: order.createdAt,
  };
}
