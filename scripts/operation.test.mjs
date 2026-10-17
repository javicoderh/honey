import assert from 'node:assert/strict';
import test from 'node:test';
import { setupPayments, remotePayment } from './fixtures/payment-store.mjs';
import { deliveryId } from './fixtures/backend-store.mjs';
import { currentPayment } from '../src/modules/payments/model.js';
import { selectSales } from '../src/modules/sales/selectors.js';
import { createPeriod } from '../src/shared/businessDates.js';
import { HttpError } from '../server/errors.mjs';

async function scenario() {
  const f = setupPayments(); const purchase = await f.purchase();
  const id = purchase.order.id;
  const response = await f.call('payments/start', { body: { orderId: id }, token: purchase.accessToken });
  assert.equal(response.status, 200);
  const checkout = f.checkouts.get(id);
  const admin = (await f.login()).headers.get('set-cookie');
  const delivery = (await f.login('delivery@example.cl')).headers.get('set-cookie');
  const update = (cookie, type, payload = {}, orderId = id) => f.call('orders/update', { cookie, body: { id: orderId, command: { type, payload } } });
  return { ...f, createPurchase: f.purchase, purchase, id, checkout, admin, delivery, update };
}

test('operación completa: pago verificado, asignación, comentario, entrega y venta comparten registro', async () => {
  const f = await scenario();
  assert.equal((await f.update(f.admin, 'delivery', { status: 'ready' })).status, 422);
  f.remote.set('1001', remotePayment(f.checkout));
  assert.equal((await f.notify('1001')).status, 200);
  assert.equal((await f.update(f.admin, 'delivery', { status: 'ready' })).status, 200);
  assert.equal((await f.update(f.admin, 'assign', { deliveryId })).status, 200);
  const assigned = (await f.call('orders/assigned', { cookie: f.delivery })).data;
  assert.equal(assigned.length, 1); assert.equal(assigned[0].id, f.id);
  assert.equal(Object.hasOwn(assigned[0], 'buyer'), false);
  assert.equal(Object.hasOwn(assigned[0].items[0], 'unitPrice'), false);
  assert.equal((await f.update(f.delivery, 'comment', { text: 'Entrega coordinada con la destinataria.' })).status, 200);
  assert.equal((await f.update(f.delivery, 'delivery', { status: 'in_transit' })).status, 200);
  assert.equal((await f.update(f.delivery, 'delivery', { status: 'delivered' })).status, 200);
  const adminOrder = (await f.call('order', { id: f.id, cookie: f.admin })).data;
  const sales = selectSales((await f.call('orders', { cookie: f.admin })).data, { period: createPeriod({ type: 'day', date: '2026-10-17' }), query: adminOrder.number });
  assert.equal(sales.length, 1); assert.equal(sales[0].totalPaid, 9990);
  assert.equal(sales[0].deliveredAt, adminOrder.delivery.deliveredAt);
  assert.equal(sales[0].order.comments.at(-1).author.id, deliveryId);
  const consumer = (await f.call('order', { id: f.id, token: f.purchase.accessToken })).data;
  assert.equal(consumer.delivery.status, 'delivered');
  assert.equal(Object.hasOwn(consumer, 'comments'), false); assert.equal(Object.hasOwn(consumer, 'history'), false);
  assert.equal((await f.update(f.admin, 'delete')).status, 422);
  assert.equal((await f.call('order', { id: f.id, cookie: f.admin })).status, 200);
});

test('pendiente y rechazo bloquean despacho; reintento aprobado conserva un pedido y una venta', async () => {
  const f = await scenario();
  for (const status of ['pending', 'rejected']) {
    f.remote.set('1001', remotePayment(f.checkout, { status, date_approved: null, date_last_updated: status === 'pending' ? '2026-10-17T12:02:00Z' : '2026-10-17T12:03:00Z' }));
    assert.equal((await f.notify('1001')).status, 200);
    assert.equal((await f.update(f.admin, 'delivery', { status: 'ready' })).status, 422);
    assert.equal(selectSales((await f.call('orders', { cookie: f.admin })).data).length, 0);
  }
  f.remote.set('1002', remotePayment(f.checkout, { id: 1002 }));
  await f.notify('1002'); await f.notify('1002');
  const orders = (await f.call('orders', { cookie: f.admin })).data;
  assert.equal(orders.length, 1); assert.equal(selectSales(orders).length, 1);
  assert.equal(currentPayment(orders[0]).providerTransactionId, '1002');
});

test('interrupción y regreso tardío recuperan pago sin perder pedido ni duplicar eventos', async () => {
  const f = await scenario(); f.remote.set('1001', remotePayment(f.checkout));
  const original = f.client.getPayment;
  f.client.getPayment = async () => { throw new HttpError(503, 'Interrupción de prueba.'); };
  assert.equal((await f.notify('1001')).status, 503);
  assert.equal(f.events.size, 0); assert.equal(f.orders.size, 1);
  f.client.getPayment = original;
  assert.equal((await f.notify('1001')).status, 200);
  const revision = f.orders.get(f.id).revision;
  await f.notify('1001');
  assert.equal(f.orders.get(f.id).revision, revision);
  // El comprador consulta después de la notificación, sin una sesión staff.
  const result = await f.call('payment', { id: f.id, token: f.purchase.accessToken });
  assert.equal(result.status, 200); assert.equal(result.data.status, 'approved');
  assert.equal(f.events.size, 1);
});

test('delivery queda acotado y un reembolso posterior bloquea su entrega asignada', async () => {
  const f = await scenario(); f.remote.set('1001', remotePayment(f.checkout)); await f.notify('1001');
  await f.update(f.admin, 'delivery', { status: 'ready' }); await f.update(f.admin, 'assign', { deliveryId });
  const other = await f.createPurchase();
  for (const route of ['orders', 'staff']) assert.equal((await f.call(route, { cookie: f.delivery })).status, 403);
  assert.equal((await f.call('payment', { id: f.id, cookie: f.delivery, token: f.purchase.accessToken })).status, 404);
  assert.equal((await f.call('payments/start', { body: { orderId: other.order.id }, cookie: f.delivery, token: other.accessToken })).status, 403);
  assert.equal((await f.update(f.delivery, 'comment', { text: 'Ajeno' }, other.order.id)).status, 403);
  assert.equal((await f.update(f.delivery, 'operations', { changes: { recipient: { name: 'Otro' } } })).status, 403);
  f.remote.set('1001', remotePayment(f.checkout, { status: 'refunded', transaction_amount_refunded: 9990, date_last_updated: '2026-10-17T12:05:00Z' }));
  assert.equal((await f.notify('1001')).status, 200);
  assert.equal((await f.call('orders/assigned', { cookie: f.delivery })).data.length, 0);
  assert.equal((await f.update(f.delivery, 'delivery', { status: 'delivered' })).status, 403);
  const sale = selectSales((await f.call('orders', { cookie: f.admin })).data)[0];
  assert.equal(sale.payment.status, 'refunded'); assert.equal(sale.netAmount, 0); assert.equal(sale.totalPaid, 9990);
});
