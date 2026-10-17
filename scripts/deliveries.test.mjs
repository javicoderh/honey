import test from "node:test";
import assert from "node:assert/strict";
import { products } from "../src/data/products.js";
import { createOrder, recordPaymentUpdate, recordDeliveryUpdate, assignOrderDelivery, addOrderComment } from "../src/modules/orders/model.js";
import { createMockAdapter } from "../src/services/mock.js";
import { deliveryView } from "../src/modules/deliveries/selectors.js";
import { selectSales } from "../src/modules/sales/selectors.js";

const admin = { id: "demo-admin", name: "Admin", role: "admin" };
const courier = { id: "demo-delivery", name: "Reparto", role: "delivery", active: true };
const other = { ...courier, id: "other-delivery", name: "Otro reparto" };
const date = "2020-01-05T12:00:00.000Z";
const login = (api, role) => api.auth.login({ email: `${role}@casamiel.demo`, password: "demo1234" });
function paid(id = "one", approved = true) {
  const order = createOrder({ id, number: `CM-${id}`, createdAt: "2020-01-01T12:00:00Z", shippingFee: 3000, catalog: products, items: [{ slug: "miel-multifloral", format: "1 kg", quantity: 2 }], draft: { buyer: { name: "Comprador privado", email: "private@example.com", phone: "+56911111111" }, recipientSameAsBuyer: false, recipient: { name: "Destinataria", phone: "+56922222222" }, shippingAddress: { street: "Calle 123", commune: "Pucón" }, deliveryInstructions: "Dejar en conserjería" } });
  return approved ? recordPaymentUpdate(order, { paymentId: order.payments[0].id, status: "approved", transactionId: `tx-${id}`, author: { id: "system", name: "Pagos", role: "system" }, at: "2020-01-02T12:00:00Z" }) : order;
}
function assigned(id = "one", assignee = courier) {
  const ready = recordDeliveryUpdate(paid(id), { status: "ready", author: admin, at: date });
  return assignOrderDelivery(ready, { assignee, author: admin, at: date });
}

test("preparación y asignación requieren pago aprobado, estado listo y delivery activo", () => {
  assert.throws(() => recordDeliveryUpdate(paid("unpaid", false), { status: "ready", author: admin, at: date }), /pago aprobado/);
  assert.throws(() => assignOrderDelivery(paid(), { assignee: courier, author: admin, at: date }), /listo/);
  const ready = recordDeliveryUpdate(paid(), { status: "ready", author: admin, at: date });
  for (const assignee of [null, { ...courier, active: false }, { ...courier, role: "admin" }]) assert.throws(() => assignOrderDelivery(ready, { assignee, author: admin, at: date }), /delivery activo/);
  const result = assignOrderDelivery(ready, { assignee: courier, author: admin, at: date });
  assert.equal(result.delivery.assignedTo, courier.id);
  assert.equal(result.history.at(-1).author.id, admin.id);
  assert.equal(result.history.at(-1).details.assignedName, courier.name);
  assert.deepEqual(result.payments, ready.payments);
});

test("reasignación exige motivo, conserva asignación previa y no duplica una asignación repetida", () => {
  const source = assigned();
  assert.equal(assignOrderDelivery(source, { assignee: courier, author: admin, at: date }), source);
  assert.throws(() => assignOrderDelivery(source, { assignee: other, author: admin, at: date }), /Motivo/);
  const result = assignOrderDelivery(source, { assignee: other, reason: "Cambio de turno", author: admin, at: date });
  assert.equal(result.history.at(-1).details.previousAssignedTo, courier.id);
  assert.equal(result.history.at(-1).details.previousAssignedName, courier.name);
  assert.equal(result.delivery.assignedTo, other.id);
  assert.throws(() => assignOrderDelivery(source, { assignee: other, reason: "Cambio", author: courier, at: date }), /administración/);
});

test("delivery solo modifica estados y comentarios de sus asignaciones", () => {
  const source = assigned();
  assert.throws(() => recordDeliveryUpdate(source, { status: "in_transit", author: other, at: date }), /asignada/);
  assert.throws(() => addOrderComment(source, { id: "x", text: "Cambio", author: other, at: date }), /asignada/);
  assert.throws(() => recordDeliveryUpdate(source, { status: "pending", author: courier, at: date }), /Estado no disponible/);
  const transit = recordDeliveryUpdate(source, { status: "in_transit", author: courier, at: date });
  const noted = addOrderComment(transit, { id: "note", text: "Voy llegando", author: courier, at: date });
  assert.equal(noted.comments[0].author.id, courier.id);
  assert.equal(noted.delivery.status, "in_transit");
});

test("confirmación y corrección de entrega conservan autor y fecha anteriores", () => {
  const source = assigned();
  const delivered = recordDeliveryUpdate(source, { status: "delivered", author: courier, at: date });
  assert.equal(delivered.delivery.deliveredBy.id, courier.id);
  assert.equal(delivered.delivery.deliveredAt, date);
  assert.throws(() => recordDeliveryUpdate(delivered, { status: "in_transit", author: courier, at: date }), /Motivo/);
  const corrected = recordDeliveryUpdate(delivered, { status: "failed", reason: "Confirmado por error; ausente", author: courier, at: date });
  assert.equal(corrected.delivery.deliveredAt, null);
  assert.equal(corrected.delivery.deliveredBy, null);
  assert.equal(corrected.history.at(-1).details.previousDeliveredAt, date);
  assert.equal(corrected.history.at(-1).details.previousDeliveredBy.id, courier.id);
  assert.equal(corrected.delivery.failureReason, "Confirmado por error; ausente");
});

test("consulta delivery omite pedidos ajenos/inactivos y datos comerciales incluso tras mutar", async () => {
  const own = assigned();
  const cancelled = { ...assigned("cancelled"), cancelledAt: date };
  const archived = { ...assigned("archived"), archivedAt: date };
  const refunded = recordPaymentUpdate(assigned("refunded"), { paymentId: "refunded:payment:1", status: "refunded", author: { id: "system", name: "Pagos", role: "system" }, at: date });
  const api = createMockAdapter({ initialOrders: [own, assigned("other", other), cancelled, archived, refunded, paid("unassigned")] });
  await assert.rejects(api.orders.listAssigned(), /sesión/);
  await login(api, "delivery");
  const records = await api.orders.listAssigned();
  assert.equal(records.length, 1);
  for (const key of ["buyer", "payments", "total", "subtotal", "shippingFee"]) assert.equal(records[0][key], undefined);
  assert.equal(records[0].items[0].unitPrice, undefined);
  assert.equal(records[0].items[0].quantity, 2);
  const updated = await api.orders.update(own.id, { type: "delivery", payload: { status: "in_transit" } });
  assert.equal(updated.payments, undefined);
  assert.equal(updated.buyer, undefined);
  assert.equal(updated.delivery.status, "in_transit");
  assert.ok(updated.history.every((event) => !event.action.startsWith("payment.")));
  const projected = deliveryView(own); projected.recipient.name = "Cambio local";
  assert.equal(own.recipient.name, "Destinataria");
});

test("adaptador bloquea consultas generales y acciones ajenas del delivery", async () => {
  const api = createMockAdapter({ initialOrders: [assigned(), assigned("other", other)] });
  await login(api, "delivery");
  for (const operation of [() => api.orders.list(), () => api.orders.getById("one"), () => api.payments.getForOrder("one"), () => api.payments.simulate("one", "approved"), () => api.staff.list()]) await assert.rejects(operation());
  for (const type of ["assign", "cancel", "archive", "delete", "operations"]) await assert.rejects(api.orders.update("one", { type, payload: {} }), /administración/);
  for (const id of ["other", "missing"]) await assert.rejects(api.orders.update(id, { type: "delivery", payload: { status: "delivered" } }), /no disponible/);
  await assert.rejects(api.orders.update("one", { type: "delivery", payload: { status: "failed" } }), /Motivo/);
});

test("asignación deriva usuario del equipo y entrega actualiza el pedido y su venta", async () => {
  const api = createMockAdapter({ initialOrders: [paid()] });
  await login(api, "admin");
  await api.orders.update("one", { type: "delivery", payload: { status: "ready" } });
  await assert.rejects(api.orders.update("one", { type: "assign", payload: { deliveryId: "unknown", assignee: courier } }), /delivery activo/);
  await assert.rejects(api.orders.update("one", { type: "assign", payload: { deliveryId: admin.id } }), /delivery activo/);
  await api.orders.update("one", { type: "assign", payload: { deliveryId: courier.id } });
  await login(api, "delivery");
  await api.orders.update("one", { type: "comment", payload: { text: "Conserje avisado", author: admin } });
  await api.orders.update("one", { type: "delivery", payload: { status: "delivered", author: admin } });
  await login(api, "admin");
  const order = await api.orders.getById("one");
  assert.equal(order.comments[0].author.id, courier.id);
  assert.equal(order.delivery.deliveredBy.id, courier.id);
  assert.equal(selectSales([order])[0].deliveredAt, order.delivery.deliveredAt);
  assert.equal(selectSales([order]).length, 1);
});
