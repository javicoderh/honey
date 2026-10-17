import { requiredText, timestamp } from "../../shared/domain.js";

export const DELIVERY_STATUS = Object.freeze({ PENDING: "pending", READY: "ready", IN_TRANSIT: "in_transit", DELIVERED: "delivered", FAILED: "failed" });
export const DELIVERY_LABELS = Object.freeze({ pending: "Pendiente", ready: "Listo para despacho", in_transit: "En reparto", delivered: "Entregado", failed: "Entrega no realizada" });

export function createDelivery({ id, orderId, createdAt }) {
  return { id: requiredText(id, "ID de despacho"), orderId: requiredText(orderId, "ID del pedido"), assignedTo: null,
    status: DELIVERY_STATUS.PENDING, createdAt: timestamp(createdAt), updatedAt: timestamp(createdAt), assignedAt: null, deliveredAt: null, deliveredBy: null, failureReason: null };
}

export function changeDeliveryStatus(delivery, status, { at, reason = "" } = {}) {
  if (!Object.values(DELIVERY_STATUS).includes(status)) throw new Error("Estado de entrega inválido");
  if (status === delivery.status) return delivery;
  if (status === DELIVERY_STATUS.FAILED) requiredText(reason, "Motivo de entrega no realizada");
  if (delivery.status === DELIVERY_STATUS.DELIVERED) requiredText(reason, "Motivo de corrección de entrega");
  const updatedAt = timestamp(at);
  if (updatedAt < delivery.updatedAt) throw new Error("La entrega no puede preceder al estado anterior");
  return { ...delivery, status, updatedAt,
    deliveredAt: status === DELIVERY_STATUS.DELIVERED ? updatedAt : null,
    failureReason: status === DELIVERY_STATUS.FAILED ? reason.trim() : null };
}
