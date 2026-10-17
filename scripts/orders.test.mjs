import test from "node:test";
import assert from "node:assert/strict";
import { createMockAdapter } from "../src/services/mock.js";
import { updateOrderOperations, changeOrderLifecycle, recordDeliveryUpdate } from "../src/modules/orders/model.js";
import { selectOrders } from "../src/modules/orders/selectors.js";

const admin = { id: "admin", name: "Admin", role: "admin" };
const at = () => new Date().toISOString();
const input = (key = "one") => ({ requestId: key, draft: { buyer: { name: "Ana Pérez", email: "ana@example.com", phone: "+56912345678" }, recipientSameAsBuyer: true, recipient: {}, shippingAddress: { street: "Calle 123", commune: "Pucón", apartment: "12", reference: "Portón" }, deliveryInstructions: "Dejar en conserjería" }, items: [{ slug: "miel-multifloral", format: "1 kg", quantity: 1 }] });
async function setup(approved = true) {
  const api = createMockAdapter();
  let order = await api.orders.create(input());
  if (approved) order = await api.payments.simulate(order.id, "approved");
  await api.auth.login({ email: "admin@casamiel.demo", password: "demo1234" });
  return { api, order };
}

test("corrección operativa preserva compra, indicaciones originales y registra diferencias", async () => {
  const { order } = await setup();
  const changed = updateOrderOperations(order, { changes: { recipient: { name: "María" }, shippingAddress: { apartment: "15" }, deliveryInstructions: "Llamar al llegar" }, reason: "Solicitado por comprador", author: admin, at: at() });
  assert.equal(changed.recipient.name, "María");
  assert.equal(changed.originalDeliveryInstructions, "Dejar en conserjería");
  assert.equal(order.recipient.name, "Ana Pérez");
  for (const key of ["items", "buyer", "total", "subtotal", "shippingFee", "payments"]) assert.deepEqual(changed[key], order[key]);
  assert.equal(changed.history.at(-1).details.changes.length, 3);
  assert.equal(changed.history.at(-1).details.changes[0].before, "Ana Pérez");
  const again = updateOrderOperations(changed, { changes: { deliveryInstructions: "Entregar a María" }, reason: "Nueva indicación", author: admin, at: at() });
  assert.equal(again.originalDeliveryInstructions, order.deliveryInstructions);
  for (const changes of [{ total: 1 }, { items: [] }, { payments: [] }, { isTest: true }, { recipient: { price: 1 } }, { recipient: { name: "" } }]) assert.throws(() => updateOrderOperations(order, { changes, reason: "Cambio", author: admin, at: at() }));
  assert.throws(() => updateOrderOperations(order, { changes: { deliveryInstructions: "Cambiar" }, reason: "", author: admin, at: at() }), /Motivo/);
});

test("cancelar y archivar conservan pago aprobado e historial, sin simular reembolso", async () => {
  const { order } = await setup();
  const cancelled = changeOrderLifecycle(order, { action: "cancel", reason: "Solicitado", author: admin, at: at() });
  assert.ok(cancelled.cancelledAt);
  assert.equal(cancelled.payments[0].status, "approved");
  assert.deepEqual(cancelled.payments, order.payments);
  const archived = changeOrderLifecycle(cancelled, { action: "archive", reason: "Resuelto", author: admin, at: at() });
  assert.ok(archived.archivedAt);
  assert.equal(archived.history.at(-1).action, "order.archived");
  assert.throws(() => recordDeliveryUpdate(cancelled, { status: "pending", author: admin, at: at() }), /cancelado/);
  assert.throws(() => updateOrderOperations(archived, { changes: {}, author: admin, at: at() }), /archivado/);
});

test("corregir entrega conserva fecha anterior y exige motivo; pago no aprobado bloquea entrega", async () => {
  const { api, order } = await setup();
  const delivered = await api.orders.update(order.id, { type: "delivery", payload: { status: "delivered" } });
  assert.ok(delivered.delivery.deliveredAt);
  await assert.rejects(api.orders.update(order.id, { type: "delivery", payload: { status: "pending" } }), /Motivo/);
  const pending = await api.orders.update(order.id, { type: "delivery", payload: { status: "pending", reason: "Confirmación equivocada" } });
  assert.equal(pending.delivery.deliveredAt, null);
  assert.equal(pending.history.at(-1).details.previousDeliveredAt, delivered.delivery.deliveredAt);
  await assert.rejects(api.orders.update(order.id, { type: "delivery", payload: { status: "failed" } }), /Motivo/);
  const unpaid = await setup(false);
  await assert.rejects(unpaid.api.orders.update(unpaid.order.id, { type: "delivery", payload: { status: "delivered" } }), /pago aprobado/);
});

test("acciones del adaptador exigen admin y derivan autor de la sesión", async () => {
  const api = createMockAdapter();
  const order = await api.orders.create(input());
  await assert.rejects(api.orders.update(order.id, { type: "comment", payload: { text: "Comentario", author: admin } }), /sesión/);
  await api.auth.login({ email: "delivery@casamiel.demo", password: "demo1234" });
  await assert.rejects(api.orders.update(order.id, { type: "delete" }), /administración/);
  await api.auth.login({ email: "admin@casamiel.demo", password: "demo1234" });
  const result = await api.orders.update(order.id, { type: "comment", payload: { text: "Llamar antes", author: { ...admin, name: "Falso" } } });
  assert.equal(result.comments[0].author.id, "demo-admin");
  assert.equal(result.comments[0].author.name, "Administración demo");
});

test("borrado requiere marca explícita de prueba, no reutiliza número ni solicitud", async () => {
  const { api, order } = await setup();
  assert.equal(order.isTest, true);
  await api.orders.update(order.id, { type: "delete" });
  assert.equal(await api.orders.getById(order.id), null);
  await assert.rejects(api.orders.create(input()), /eliminado/);
  assert.notEqual((await api.orders.create(input("two"))).number, order.number);
  const protectedApi = createMockAdapter({ initialOrders: [{ ...order, isTest: false }] });
  await protectedApi.auth.login({ email: "admin@casamiel.demo", password: "demo1234" });
  await assert.rejects(protectedApi.orders.update(order.id, { type: "delete" }), /registros de prueba/);
  assert.ok(await protectedApi.orders.getById(order.id));
});

test("filtros distinguen pendientes, entregados, cancelados, archivados y búsqueda", async () => {
  const { order } = await setup();
  const delivered = { ...order, id: "delivered", number: "DEMO-2", createdAt: "2001-01-01T00:00:00Z", delivery: { ...order.delivery, status: "delivered" } };
  const cancelled = { ...order, id: "cancelled", cancelledAt: at() };
  const archived = { ...order, id: "archived", archivedAt: at() };
  const records = [delivered, order, cancelled, archived];
  assert.deepEqual(selectOrders(records, { filter: "pending", includeArchived: false }).map((entry) => entry.id), [order.id]);
  assert.deepEqual(selectOrders(records, { filter: "delivered" }).map((entry) => entry.id), ["delivered"]);
  assert.equal(selectOrders(records, { query: "PÉREZ" }).length, 4);
  assert.equal(selectOrders(records, { query: "demo-2" })[0].id, "delivered");
  assert.equal(selectOrders(records, { includeArchived: false }).length, 3);
  assert.equal(selectOrders(records).at(-1).id, "delivered");
});
