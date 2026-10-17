import test from "node:test";
import assert from "node:assert/strict";
import { products } from "../src/data/products.js";
import { createOrder, recordPaymentUpdate, recordDeliveryUpdate, addOrderComment } from "../src/modules/orders/model.js";
import { selectSales } from "../src/modules/sales/selectors.js";
import { resolveSalesPeriod, summarizeSales } from "../src/modules/sales/model.js";
import { createPeriod } from "../src/shared/businessDates.js";

const admin = { id: "admin", name: "Admin", role: "admin" };
const system = { id: "system", name: "Pagos", role: "system" };
function order(id, status = "approved", paidAt = "2026-10-17T12:00:00Z") {
  const source = createOrder({ id, number: `CM-${id}`, createdAt: "2026-10-01T12:00:00Z", shippingFee: 3000, catalog: products,
    items: [{ slug: "miel-multifloral", format: "1 kg", quantity: 1 }], draft: { buyer: { name: "Ana Pérez", email: "ana@example.com", phone: "+56912345678" }, recipientSameAsBuyer: true, recipient: {}, shippingAddress: { street: "Calle 123", commune: "Pucón" }, deliveryInstructions: "Llamar antes" } });
  if (status === "pending") return source;
  const paid = recordPaymentUpdate(source, { paymentId: source.payments[0].id, status: status === "refunded" ? "approved" : status, transactionId: `tx-${id}`, at: paidAt, author: system });
  return status === "refunded" ? recordPaymentUpdate(paid, { paymentId: paid.payments[0].id, status, at: "2026-11-01T12:00:00Z", author: system }) : paid;
}

test("venta usa fecha de aprobación en Chile e incluye ambos extremos del período", () => {
  const period = createPeriod({ type: "day", date: "2026-10-17" });
  const records = [order("before", "approved", "2026-10-17T02:59:59Z"), order("first", "approved", "2026-10-17T03:00:00Z"), order("last", "approved", "2026-10-18T02:59:59Z"), order("after", "approved", "2026-10-18T03:00:00Z")];
  assert.deepEqual(selectSales(records, { period }).map((sale) => sale.id), ["last", "first"]);
  assert.equal(selectSales(records, { period: createPeriod({ type: "day", date: "2026-10-01" }) }).length, 0);
});

test("aprobados y reembolsados se totalizan separados; cancelar/archivar no borra el cobro", () => {
  const records = [order("one"), { ...order("cancelled"), cancelledAt: "2026-10-18T12:00:00Z" }, { ...order("archived"), archivedAt: "2026-10-18T12:00:00Z" }, order("refund", "refunded"), order("pending", "pending"), order("rejected", "rejected")];
  const sales = selectSales(records, { period: createPeriod({ type: "month", date: "2026-10-01" }) });
  assert.equal(sales.length, 4);
  assert.deepEqual(summarizeSales(sales), { approvedCount: 3, approvedTotal: 29970, refundedCount: 1, refundedTotal: 9990 });
  assert.equal(selectSales(records, { period: createPeriod({ type: "month", date: "2026-11-01" }) }).length, 0, "No clasifica el reembolso por su fecha de devolución");
  assert.equal(sales.find((sale) => sale.id === "refund").netAmount, 0);
});

test("búsqueda por pedido, pago interno, transacción y contacto del comprador", () => {
  const source = order("needle");
  for (const query of [source.number, source.payments[0].id, "TX-NEEDLE", "pÉrEz", "ana@example.com", "+56912345678"]) assert.equal(selectSales([source], { query }).length, 1);
  assert.equal(selectSales([source], { query: "no existe" }).length, 0);
  assert.equal(selectSales([source], { query: "Ana", period: createPeriod({ type: "day", date: "2026-10-16" }) }).length, 0);
});

test("períodos anteriores, semanas completas y mes bisiesto, con validación de rango", () => {
  const week = resolveSalesPeriod({ type: "week", date: "2027-01-01" });
  assert.equal(week.startDate, "2026-12-28");
  assert.equal(week.endDate, "2027-01-03");
  assert.equal(resolveSalesPeriod({ type: "month", month: "2028-02" }).endDate, "2028-02-29");
  const range = resolveSalesPeriod({ type: "range", date: "2025-01-01", endDate: "2025-01-31" });
  assert.equal(range.endDate, "2025-01-31");
  assert.throws(() => resolveSalesPeriod({ type: "range", date: "2026-10-18", endDate: "2026-10-17" }), /preceder/);
  assert.throws(() => resolveSalesPeriod({ type: "month", month: "" }), /mes válido/);
  assert.throws(() => resolveSalesPeriod({ type: "month", month: "2026-13" }));
  assert.throws(() => resolveSalesPeriod({ type: "day", date: "2026-02-30" }));
});

test("venta referencia el mismo pedido y refleja comentario y entrega sin duplicación", () => {
  let source = order("shared");
  source = addOrderComment(source, { id: "note", text: "Coordinado", author: admin, at: "2026-10-18T12:00:00Z" });
  source = recordDeliveryUpdate(source, { status: "delivered", author: admin, at: "2026-10-18T13:00:00Z" });
  const sales = selectSales([source]);
  assert.equal(sales.length, 1);
  assert.equal(sales[0].order, source);
  assert.equal(sales[0].order.comments[0].text, "Coordinado");
  assert.equal(sales[0].deliveredAt, source.delivery.deliveredAt);
  assert.equal(sales[0].order.deliveryInstructions, "Llamar antes");
});

test("consulta vacía tiene importes cero y no incluye pedidos sin pago aprobado", () => {
  assert.deepEqual(summarizeSales(selectSales([order("pending", "pending"), order("no", "rejected")])), { approvedCount: 0, approvedTotal: 0, refundedCount: 0, refundedTotal: 0 });
});
