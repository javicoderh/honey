import { isInPeriod } from "../../shared/businessDates.js";

export function selectOrders(orders, { period, query = "", filter = "all", includeArchived = true } = {}) {
  const search = query.trim().toLocaleLowerCase("es-CL");
  return orders.filter((order) => (!period || isInPeriod(order.createdAt, period))
    && (includeArchived || !order.archivedAt)
    && (filter !== "pending" || (!order.cancelledAt && order.delivery.status !== "delivered"))
    && (filter !== "delivered" || order.delivery.status === "delivered")
    && (!search || [order.number, order.buyer.name, order.buyer.email, order.buyer.phone].join(" ").toLocaleLowerCase("es-CL").includes(search)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
