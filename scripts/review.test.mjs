import assert from "node:assert/strict";
import test from "node:test";
import { createReviewOrders } from "./fixtures/review-orders.mjs";
import { createMockAdapter } from "../src/services/mock.js";
import { currentPayment } from "../src/modules/payments/model.js";

test("escenarios de revisión cubren pagos y entregas sin contaminar el adaptador normal", async () => {
  const orders = createReviewOrders();
  assert.deepEqual(new Set(orders.map(order => currentPayment(order).status)), new Set(["pending", "rejected", "approved"]));
  assert.deepEqual(new Set(orders.map(order => order.delivery.status)), new Set(["pending", "ready", "in_transit", "failed", "delivered"]));
  assert.equal(new Set(orders.map(order => order.id)).size, 7);
  for (const order of orders) {
    assert.equal(order.isTest, true);
    assert.ok(order.comments.length && order.deliveryInstructions && order.shippingAddress.reference);
    assert.notEqual(order.buyer.name, order.recipient.name);
    if (order.delivery.status !== "pending") assert.equal(currentPayment(order).status, "approved");
  }
  const adapter = createMockAdapter({ initialOrders: orders });
  await adapter.auth.login({ email: "delivery@casamiel.demo", password: "demo1234" });
  const assigned = await adapter.orders.listAssigned();
  assert.equal(assigned.length, 4);
  assert.equal(assigned.some(order => Object.hasOwn(order, "buyer")), false);
  assert.equal((await createMockAdapter().orders.list()).length, 0);
});
