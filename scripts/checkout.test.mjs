import test from "node:test";
import assert from "node:assert/strict";
import { createMockAdapter } from "../src/services/mock.js";
import { createPurchaseDraft } from "../src/modules/purchase/model.js";
import { validateCheckout } from "../src/modules/purchase/checkout.js";

const draft = () => ({ ...createPurchaseDraft(), buyer: { name: "Ana", email: "ana@example.com", phone: "+56912345678" }, shippingAddress: { street: "Calle 123", commune: "Comuna demo", apartment: "", reference: "Portón azul" } });
const input = () => ({ requestId: "purchase-1", draft: draft(), items: [{ slug: "miel-multifloral", format: "1 kg", quantity: 2 }] });

test("validación por campo y destinatario alternativo", () => {
  assert.equal(Object.keys(validateCheckout(createPurchaseDraft())).length, 5);
  assert.deepEqual(validateCheckout(draft()), {});
  const data = draft(); data.recipientSameAsBuyer = false;
  assert.ok(validateCheckout(data)["recipient.name"]);
  data.buyer.email = "correo"; data.buyer.phone = "hola";
  assert.ok(validateCheckout(data)["buyer.email"]);
  assert.ok(validateCheckout(data)["buyer.phone"]);
});

test("checkout congela importes y datos y no duplica el pedido", async () => {
  const api = createMockAdapter();
  const request = input();
  const [first, second] = await Promise.all([api.orders.create(request), api.orders.create(request)]);
  assert.equal(first.id, second.id);
  assert.equal(first.total, 16980);
  assert.equal(first.shippingFee, 3000);
  assert.equal(first.payments[0].status, "pending");
  assert.equal((await api.orders.list()).length, 1);
  request.draft.buyer.name = "Otra persona";
  assert.equal((await api.orders.getById(first.id)).buyer.name, "Ana");
  assert.equal((await api.orders.create(request)).id, first.id);
});

test("rechazo, error de conexión y reintento conservan el pedido y registran intentos", async () => {
  const api = createMockAdapter();
  const order = await api.orders.create(input());
  await api.payments.simulate(order.id, "rejected");
  await assert.rejects(api.payments.simulate(order.id, "connection_error"), /conectar/);
  assert.equal((await api.payments.getForOrder(order.id)).status, "rejected");
  const approved = await api.payments.simulate(order.id, "approved");
  assert.equal(approved.payments.length, 2);
  assert.equal(approved.payments[0].status, "rejected");
  assert.equal(approved.payments[1].status, "approved");
  assert.equal((await api.orders.list()).length, 1);
  assert.deepEqual(await api.payments.simulate(order.id, "approved"), approved);
});

test("pago pendiente no se aprueba sin acción del simulador", async () => {
  const api = createMockAdapter();
  const order = await api.orders.create(input());
  await api.payments.simulate(order.id, "pending");
  assert.equal((await api.payments.getForOrder(order.id)).status, "pending");
  assert.equal((await api.orders.getById(order.id)).delivery.deliveredAt, null);
  await assert.rejects(api.payments.simulate(order.id, "invalid"));
});
