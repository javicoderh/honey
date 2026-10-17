import { currentPayment } from "../payments/model.js";
import { isInPeriod } from "../../shared/businessDates.js";

// Vistas derivadas, no un segundo registro editable de ventas o entregas.
export function selectSales(orders, { period, query = "" } = {}) {
  const search = query.trim().toLocaleLowerCase("es-CL");
  return orders.flatMap((order) => {
    const payment = currentPayment(order);
    if (!payment?.approvedAt || (period && !isInPeriod(payment.approvedAt, period))) return [];
    const searchable = [order.number, order.buyer.name, order.buyer.email, order.buyer.phone, payment.id, payment.providerTransactionId].join(" ").toLocaleLowerCase("es-CL");
    if (search && !searchable.includes(search)) return [];
    return [{ id: order.id, order, payment, totalPaid: payment.amount, netAmount: payment.status === "refunded" ? 0 : payment.amount,
      createdAt: order.createdAt, paidAt: payment.approvedAt, deliveredAt: order.delivery.deliveredAt }];
  }).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

