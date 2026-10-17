import { currentPayment } from "../payments/model.js";
import { selectOrders } from "../orders/selectors.js";

export function selectAssignedOrders(orders, deliveryId) {
  if (!deliveryId) return [];
  return selectOrders(orders).filter((order) => order.delivery.assignedTo === deliveryId && currentPayment(order)?.status === "approved" && !order.cancelledAt && !order.archivedAt);
}
