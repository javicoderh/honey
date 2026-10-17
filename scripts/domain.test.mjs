import test from "node:test";
import assert from "node:assert/strict";
import { products } from "../src/data/products.js";
import { createPurchaseDraft, updatePurchaseDraft, resolveRecipient } from "../src/modules/purchase/model.js";
import { createOrder, recordPaymentUpdate, recordDeliveryUpdate, addOrderComment, canPrepareOrder, assignOrderDelivery } from "../src/modules/orders/model.js";
import { createPayment, currentPayment, changePaymentStatus } from "../src/modules/payments/model.js";
import { selectSales } from "../src/modules/sales/selectors.js";
import { selectOrders } from "../src/modules/orders/selectors.js";
import { selectAssignedOrders } from "../src/modules/deliveries/selectors.js";
import { businessDate, createPeriod, isInPeriod } from "../src/shared/businessDates.js";
import { createMockAdapter } from "../src/services/mock.js";

const createdAt = "2026-10-16T13:00:00.000Z";
const paidAt = "2026-10-17T13:00:00.000Z";
const deliveredAt = "2026-10-18T13:00:00.000Z";
const admin = { id: "admin-1", name: "Administración de prueba", role: "admin" };
const system = { id: "system", name: "Servicio de pagos", role: "system" };
const delivery = { id: "delivery-1", name: "Reparto de prueba", role: "delivery" };

function draft() {
  return updatePurchaseDraft(createPurchaseDraft(), {
    buyer: { name: "Compradora de prueba", email: "compra@example.test", phone: "+56911111111" },
    shippingAddress: { street: "Dirección de prueba 123", commune: "Pucón", apartment: "12", reference: "Entrada lateral" },
    deliveryInstructions: "Dejar con el conserje",
  });
}

function order(changes = {}) {
  return createOrder({ id: "demo-1", number: "CM-0001", draft: draft(), items: [{ slug: "miel-multifloral", format: "1 kg", quantity: 2 }], catalog: products, shippingFee: 1500, createdAt, ...changes });
}

function approved(source = order()) {
  return recordPaymentUpdate(source, { paymentId: source.payments[0].id, status: "approved", transactionId: `mp-${source.id}`, at: paidAt, author: system });
}

function assigned() {
  const ready = recordDeliveryUpdate(approved(), { status: "ready", at: paidAt, author: admin });
  return assignOrderDelivery(ready, { assignee: { ...delivery, active: true }, at: paidAt, author: admin });
}

test("pedido nuevo: pago y entrega pendientes, importes completos e indicaciones", () => {
  const result = order();
  assert.equal(result.subtotal, 13980);
  assert.equal(result.shippingFee, 1500);
  assert.equal(result.total, 15480);
  assert.equal(result.currency, "CLP");
  assert.equal(result.payments[0].amount, result.total);
  assert.equal(result.payments[0].status, "pending");
  assert.equal(result.payments[0].approvedAt, null);
  assert.equal(result.delivery.status, "pending");
  assert.equal(result.delivery.deliveredAt, null);
  assert.equal(result.delivery.assignedTo, null);
  assert.equal(result.delivery.orderId, result.id);
  assert.equal(result.deliveryInstructions, "Dejar con el conserje");
  assert.equal(result.shippingAddress.reference, "Entrada lateral");
  assert.deepEqual(result.comments, []);
  assert.equal(result.history[0].author.role, "consumer");
  assert.equal(result.cancelledAt, null);
});

test("destinatario igual al comprador por defecto, con copias independientes", () => {
  const result = order();
  assert.equal(result.recipient.name, result.buyer.name);
  result.recipient.name = "Otra persona";
  assert.notEqual(result.recipient.name, result.buyer.name);
});

test("borrador combina campos sin perder datos y permite otro destinatario", () => {
  const original = draft();
  const changed = updatePurchaseDraft(original, { buyer: { phone: "+56922222222" }, recipientSameAsBuyer: false, recipient: { name: "Destinataria", phone: "+56933333333" } });
  assert.equal(changed.buyer.email, original.buyer.email);
  assert.equal(original.buyer.phone, "+56911111111");
  assert.equal(changed.shippingAddress.apartment, "12");
  assert.equal(createOrder({ id: "demo-2", number: "CM-2", draft: changed, catalog: products, items: [{ slug: "miel-de-cerezo", format: "1 kg", quantity: 1 }], shippingFee: 0, createdAt }).recipient.name, "Destinataria");
  assert.equal(resolveRecipient(updatePurchaseDraft(changed, { recipientSameAsBuyer: true })).phone, "+56922222222");
});

test("el pedido conserva productos, precios y datos originales aunque cambien las fuentes", () => {
  const catalog = structuredClone(products);
  const buyerDraft = draft();
  const result = order({ catalog, draft: buyerDraft });
  catalog.find((product) => product.slug === "miel-multifloral").sizes[0].price = 1;
  buyerDraft.buyer.name = "Nombre cambiado";
  assert.equal(result.items[0].unitPrice, 6990);
  assert.equal(result.items[0].lineTotal, 13980);
  assert.equal(result.total, 15480);
  assert.equal(result.buyer.name, "Compradora de prueba");
});

test("no se crean pedidos sin costo de despacho definido ni con cantidades o formatos inválidos", () => {
  assert.throws(() => order({ shippingFee: undefined }), /Costo de despacho/);
  assert.throws(() => order({ shippingFee: -1 }), /Costo de despacho/);
  for (const quantity of [0, -1, 1.5, "1", Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => order({ items: [{ slug: "miel-multifloral", format: "1 kg", quantity }] }));
  }
  assert.throws(() => order({ items: [] }), /requiere productos/);
  assert.throws(() => order({ items: [{ slug: "miel-multifloral", format: "500 g", quantity: 1 }] }), /no disponible/);
});

test("pedido exige datos de comprador, destinatario y dirección", () => {
  assert.throws(() => order({ draft: updatePurchaseDraft(draft(), { buyer: { email: "sin-correo" } }) }), /Correo/);
  assert.throws(() => order({ draft: updatePurchaseDraft(draft(), { shippingAddress: { commune: "" } }) }), /Comuna/);
  assert.throws(() => order({ draft: updatePurchaseDraft(draft(), { recipientSameAsBuyer: false }) }), /Destinatario/);
});

test("un pago aprobado conserva el monto, transacción, fecha e historial", () => {
  const original = order();
  const result = approved(original);
  assert.equal(currentPayment(result).providerTransactionId, "mp-demo-1");
  assert.equal(currentPayment(result).approvedAt, paidAt);
  assert.equal(currentPayment(result).amount, result.total);
  assert.equal(result.history.at(-1).author.role, "system");
  assert.equal(original.payments[0].status, "pending");
  assert.equal(canPrepareOrder(result), true);
});

test("repetir la aprobación no duplica historia ni venta", () => {
  const source = approved();
  const repeated = approved(source);
  assert.equal(repeated, source);
  assert.equal(selectSales([repeated]).length, 1);
  assert.throws(() => recordPaymentUpdate(source, { paymentId: source.payments[0].id, status: "approved", transactionId: "otra-transaccion", at: paidAt, author: system }), /no corresponde/);
});

test("no se aprueba sin ID de transacción ni se cambia un pago terminal", () => {
  const source = order().payments[0];
  assert.throws(() => changePaymentStatus(source, "approved", { at: paidAt }), /transacción/);
  const rejected = changePaymentStatus(source, "rejected", { at: paidAt });
  assert.throws(() => changePaymentStatus(rejected, "approved", { at: paidAt, transactionId: "mp-test" }), /Transición/);
  assert.throws(() => changePaymentStatus(source, "desconocido", { at: paidAt }), /Estado/);
});

test("dos intentos aprobados no duplican una venta", () => {
  const source = approved();
  source.payments.push(createPayment({ id: "payment-2", orderId: source.id, amount: source.total, createdAt }));
  assert.throws(() => recordPaymentUpdate(source, { paymentId: "payment-2", status: "approved", transactionId: "mp-2", at: paidAt, author: system }), /ya registra una venta/);
});

test("sin pago aprobado no se prepara ni entrega; cancelar no implica reembolso", () => {
  const source = order();
  assert.equal(canPrepareOrder(source), false);
  for (const status of ["ready", "in_transit", "delivered", "failed"]) {
    assert.throws(() => recordDeliveryUpdate(source, { status, at: deliveredAt, author: admin, reason: "Prueba" }), /pago aprobado/);
  }
  const cancelled = { ...approved(), cancelledAt: deliveredAt };
  assert.equal(canPrepareOrder(cancelled), false);
  assert.equal(currentPayment(cancelled).status, "approved");
  assert.equal(selectSales([cancelled]).length, 1);
});

test("entrega registra fecha automáticamente y conserva la anterior al corregirla", () => {
  const source = assigned();
  const completed = recordDeliveryUpdate(source, { status: "delivered", at: deliveredAt, author: delivery });
  assert.equal(completed.delivery.deliveredAt, deliveredAt);
  assert.equal(completed.history.at(-1).author.id, delivery.id);
  assert.equal(selectSales([completed])[0].deliveredAt, deliveredAt);
  assert.equal(selectSales([completed])[0].order, completed);
  assert.throws(() => recordDeliveryUpdate(completed, { status: "pending", at: deliveredAt, author: admin }), /Motivo de corrección/);
  const corrected = recordDeliveryUpdate(completed, { status: "pending", at: "2026-10-18T14:00:00Z", author: admin, reason: "Marcado por error" });
  assert.equal(corrected.delivery.deliveredAt, null);
  assert.equal(corrected.history.at(-1).details.previousDeliveredAt, deliveredAt);
  assert.equal(completed.delivery.status, "delivered");
});

test("entrega fallida exige motivo y las fechas no retroceden", () => {
  assert.throws(() => recordDeliveryUpdate(assigned(), { status: "failed", at: deliveredAt, author: delivery }), /Motivo/);
  const failed = recordDeliveryUpdate(assigned(), { status: "failed", at: deliveredAt, author: delivery, reason: "Destinatario ausente" });
  assert.equal(failed.delivery.failureReason, "Destinatario ausente");
  assert.equal(failed.delivery.deliveredAt, null);
  assert.throws(() => recordDeliveryUpdate(failed, { status: "pending", at: paidAt, author: admin }), /preceder/);
});

test("comentarios internos conservan autor y fecha sin alterar indicaciones del comprador", () => {
  const source = assigned();
  const result = addOrderComment(source, { id: "comment-1", text: "Conserje avisado", author: delivery, at: deliveredAt });
  assert.equal(result.comments[0].author.id, delivery.id);
  assert.equal(result.comments[0].createdAt, deliveredAt);
  assert.equal(result.deliveryInstructions, "Dejar con el conserje");
  assert.equal(result.history.at(-1).details.commentId, "comment-1");
  assert.equal(source.comments.length, 0);
  assert.throws(() => addOrderComment(source, { id: "c", text: "Texto", author: { id: "guest", name: "Invitado", role: "consumer" }, at: paidAt }), /equipo/);
});

test("reembolso conserva la venta histórica, su aprobación y el importe original", () => {
  const source = approved();
  const result = recordPaymentUpdate(source, { paymentId: source.payments[0].id, status: "refunded", at: deliveredAt, author: system });
  const sale = selectSales([result])[0];
  assert.equal(sale.totalPaid, result.total);
  assert.equal(sale.netAmount, 0);
  assert.equal(sale.paidAt, paidAt);
  assert.equal(sale.payment.refundedAt, deliveredAt);
  assert.equal(canPrepareOrder(result), false);
});

test("ventas se filtran por fecha de pago, no por ingreso, y por comprador/transacción", () => {
  const source = approved();
  assert.equal(selectOrders([source], { period: createPeriod({ type: "day", date: "2026-10-16" }) }).length, 1);
  assert.equal(selectSales([source], { period: createPeriod({ type: "day", date: "2026-10-16" }) }).length, 0);
  assert.equal(selectSales([source], { period: createPeriod({ type: "day", date: "2026-10-17" }), query: "MP-DEMO-1" }).length, 1);
  assert.equal(selectSales([source], { query: "compradora" }).length, 1);
  assert.equal(selectSales([source], { query: "no existe" }).length, 0);
});

test("entregas derivadas excluyen pedidos ajenos, sin asignar, cancelados y sin pago", () => {
  const paid = approved();
  const assigned = { ...paid, delivery: { ...paid.delivery, assignedTo: delivery.id } };
  assert.deepEqual(selectAssignedOrders([assigned], null), []);
  assert.deepEqual(selectAssignedOrders([assigned], "otro-delivery"), []);
  assert.equal(selectAssignedOrders([assigned], delivery.id)[0], assigned);
  assert.deepEqual(selectAssignedOrders([{ ...assigned, cancelledAt: deliveredAt }], delivery.id), []);
  assert.deepEqual(selectAssignedOrders([order()], delivery.id), []);
});

test("calendario chileno usa el día local y semanas de lunes a domingo", () => {
  assert.equal(businessDate("2026-10-17T02:59:59Z"), "2026-10-16");
  assert.equal(businessDate("2026-10-17T03:00:00Z"), "2026-10-17");
  const week = createPeriod({ type: "week", date: "2026-10-18" });
  assert.equal(week.startDate, "2026-10-12");
  assert.equal(week.endDate, "2026-10-18");
  assert.equal(createPeriod({ type: "week", date: "2027-01-01" }).startDate, "2026-12-28");
  assert.equal(createPeriod({ type: "month", date: "2028-02-15" }).endDate, "2028-02-29");
  assert.equal(isInPeriod("2026-10-19T02:59:59Z", week), true);
  assert.equal(isInPeriod("2026-10-19T03:00:00Z", week), false);
});

test("cambio de horario no pierde ventas; rangos inclusivos y fechas inválidas", () => {
  const period = createPeriod({ type: "day", date: "2026-09-06" });
  assert.equal(isInPeriod("2026-09-06T03:59:59Z", period), false);
  assert.equal(isInPeriod("2026-09-06T04:00:00Z", period), true);
  assert.equal(isInPeriod("2026-09-07T02:59:59Z", period), true);
  assert.equal(isInPeriod("2026-09-07T03:00:00Z", period), false);
  const range = createPeriod({ type: "range", date: "2026-10-01", endDate: "2026-10-03" });
  assert.equal(range.endDate, "2026-10-03");
  assert.throws(() => createPeriod({ type: "day", date: "2026-02-30" }), /inválida/);
  assert.throws(() => createPeriod({ type: "range", date: "2026-10-03", endDate: "2026-10-01" }), /preceder/);
});

test("el adaptador devuelve el mismo pago del pedido sin exponer referencias mutables", async () => {
  const source = approved();
  const adapter = createMockAdapter({ initialOrders: [source] });
  source.buyer.name = "Nombre modificado fuera del servicio";
  const listed = await adapter.orders.list();
  const saved = await adapter.orders.getById(source.id);
  const payment = await adapter.payments.getForOrder(source.id);
  assert.equal(saved.buyer.name, "Compradora de prueba");
  assert.deepEqual(payment, saved.payments[0]);
  listed[0].payments[0].amount = 1;
  assert.equal((await adapter.payments.getForOrder(source.id)).amount, 15480);
  assert.equal(await adapter.orders.getById("no-existe"), null);
  assert.equal(await adapter.payments.getForOrder("no-existe"), null);
});
