import { money, requiredText, timestamp } from "../../shared/domain.js";

export const PAYMENT_STATUS = Object.freeze({ PENDING: "pending", APPROVED: "approved", REJECTED: "rejected", REFUNDED: "refunded" });
export const PAYMENT_LABELS = Object.freeze({ pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado", refunded: "Reembolsado" });

export function createPayment({ id, orderId, amount, createdAt }) {
  return {
    id: requiredText(id, "ID del pago"), orderId: requiredText(orderId, "ID del pedido"),
    providerTransactionId: null, currency: "CLP", amount: money(amount), status: PAYMENT_STATUS.PENDING,
    createdAt: timestamp(createdAt), updatedAt: timestamp(createdAt), approvedAt: null, refundedAt: null,
  };
}

// Función de dominio: el adaptador real solo la invocará tras verificar el pago.
export function changePaymentStatus(payment, status, { at, transactionId } = {}) {
  if (!Object.values(PAYMENT_STATUS).includes(status)) throw new Error("Estado de pago inválido");
  if (transactionId && payment.providerTransactionId && transactionId !== payment.providerTransactionId) throw new Error("La transacción no corresponde al pago");
  if (status === payment.status) return payment;
  const allowed = { pending: ["approved", "rejected"], approved: ["refunded"], rejected: [], refunded: [] };
  if (!allowed[payment.status].includes(status)) throw new Error("Transición de pago inválida");
  const updatedAt = timestamp(at);
  if (updatedAt < payment.updatedAt) throw new Error("El cambio de pago no puede preceder al anterior");
  const providerTransactionId = transactionId || payment.providerTransactionId;
  if (status === PAYMENT_STATUS.APPROVED) requiredText(providerTransactionId, "ID de transacción");
  return { ...payment, status, providerTransactionId, updatedAt,
    approvedAt: status === PAYMENT_STATUS.APPROVED ? updatedAt : payment.approvedAt,
    refundedAt: status === PAYMENT_STATUS.REFUNDED ? updatedAt : payment.refundedAt };
}

export function currentPayment(order) {
  return order.payments.find((payment) => payment.approvedAt) ?? order.payments.at(-1) ?? null;
}
