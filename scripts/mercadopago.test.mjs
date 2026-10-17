import assert from 'node:assert/strict';
import test from 'node:test';
import { createMercadoPagoClient, verifyWebhook } from '../server/mercadopago/client.mjs';
import { reconcilePayment } from '../server/mercadopago/reconcile.mjs';
import { validateCheckoutUrl } from '../src/modules/payments/checkoutUrl.js';
import { currentPayment } from '../src/modules/payments/model.js';
import { canPrepareOrder } from '../src/modules/orders/model.js';
import { selectSales } from '../src/modules/sales/selectors.js';
import { setupPayments, signedRequest, mpConfig, paymentTime, remotePayment } from './fixtures/payment-store.mjs';

async function ready(options) {
  const fixture = setupPayments(options); const purchase = await fixture.purchase();
  const start = await fixture.call('payments/start', { body: { orderId: purchase.order.id }, token: purchase.accessToken });
  assert.equal(start.status, 200, JSON.stringify(start.data));
  return { ...fixture, purchase, start, checkout: fixture.checkouts.get(purchase.order.id) };
}

test('integración queda desactivada sin configuración y no realiza llamadas externas', async () => {
  const fixture = setupPayments({ enabled: false }); const purchase = await fixture.purchase();
  assert.deepEqual((await fixture.call('payments/capabilities')).data, { enabled: false });
  assert.equal((await fixture.call('payments/start', { body: { orderId: purchase.order.id }, token: purchase.accessToken })).status, 503);
  assert.equal(fixture.outbound.length, 0);
  assert.equal(createMercadoPagoClient().ready, false);
  assert.equal(createMercadoPagoClient(mpConfig, { origin: 'http://localhost:5173' }).ready, false);
});

test('preferencia usa importes guardados, referencia propia, URLs privadas y un único enlace reutilizable', async () => {
  const f = await ready();
  const request = f.outbound[0]; const body = JSON.parse(request.options.body);
  assert.equal(body.items.reduce((total, item) => total + item.quantity * item.unit_price, 0), 9990);
  assert.equal(body.items.every(item => item.currency_id === 'CLP'), true);
  assert.equal(body.external_reference, f.checkout.attempt_id);
  assert.equal(request.options.headers['X-Idempotency-Key'], f.checkout.attempt_id);
  assert.match(body.back_urls.success, /#pedido=/); assert.match(body.notification_url, /route=payments%2Fwebhook/);
  assert.equal(Object.hasOwn(body, 'payer'), false);
  await f.call('payments/start', { body: { orderId: f.purchase.order.id, amount: 1, returnUrl: 'https://evil.example' }, token: f.purchase.accessToken });
  assert.equal(f.outbound.filter(call => call.url.endsWith('/checkout/preferences')).length, 1);
});

test('inicio exige referencia privada y no permite pagar un pedido ya aprobado o cancelado', async () => {
  const f = await ready(); const body = { orderId: f.purchase.order.id };
  assert.equal((await f.call('payments/start', { body })).status, 404);
  f.remote.set('1001', remotePayment(f.checkout)); await f.notify('1001');
  assert.equal((await f.call('payments/start', { body, token: f.purchase.accessToken })).status, 409);
  const other = await ready(); other.orders.get(other.purchase.order.id).data.cancelledAt = paymentTime;
  assert.equal((await other.call('payments/start', { body: { orderId: other.purchase.order.id }, token: other.purchase.accessToken })).status, 409);
});

test('inicios simultáneos reservan una única preferencia mientras responde el proveedor', { timeout: 3000 }, async () => {
  let release; const waiting = new Promise(resolve => { release = resolve; });
  const f = setupPayments({ providerFetch: async () => { await waiting; return new Response(JSON.stringify({ id: 'pref-1', collector_id: 12345, sandbox_init_point: 'https://sandbox.mercadopago.cl/checkout/v1/redirect' })); } });
  const purchase = await f.purchase(); const args = { body: { orderId: purchase.order.id }, token: purchase.accessToken };
  const first = f.call('payments/start', args);
  for (let attempt = 0; attempt < 100 && !f.outbound.length; attempt++) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(f.outbound.length, 1);
  const second = await f.call('payments/start', args); assert.equal(second.status, 409);
  release(); assert.equal((await first).status, 200); assert.equal(f.outbound.length, 1);
});

test('si la preferencia queda incierta no se crea otra automáticamente al reintentar', async () => {
  const f = setupPayments({ providerFetch: async () => { throw Error('network lost'); } });
  const purchase = await f.purchase(); const args = { body: { orderId: purchase.order.id }, token: purchase.accessToken };
  assert.equal((await f.call('payments/start', args)).status, 503);
  assert.equal(f.checkouts.get(purchase.order.id).state, 'uncertain');
  assert.equal((await f.call('payments/start', args)).status, 409);
  assert.equal(f.outbound.length, 1);
});

test('redirecciones solo admiten hosts chilenos HTTPS y distinguen sandbox de producción', () => {
  assert.match(validateCheckoutUrl('https://sandbox.mercadopago.cl/checkout/v1/redirect?pref_id=a', 'sandbox'), /^https:/);
  for (const url of ['https://evil.example/checkout/', 'https://sandbox.mercadopago.cl.evil.example/checkout/', 'http://sandbox.mercadopago.cl/checkout/', 'https://sandbox.mercadopago.cl:444/checkout/', 'https://user@sandbox.mercadopago.cl/checkout/', 'javascript:alert(1)', 'https://www.mercadopago.cl/checkout/']) assert.throws(() => validateCheckoutUrl(url, 'sandbox'));
});

test('firma HMAC admite segundos/milisegundos y rechaza firma falsa, repetida, vencida o identificador alterado', () => {
  const now = Date.parse(paymentTime);
  assert.equal(verifyWebhook(signedRequest('1001'), mpConfig.webhookSecret, now), '1001');
  assert.equal(verifyWebhook(signedRequest('1001', { ts: String(now / 1000) }), mpConfig.webhookSecret, now), '1001');
  for (const request of [signedRequest('1001', { secret: 'wrong' }), signedRequest('1001', { ts: String(now - 600000) }), signedRequest('1001', { query: '&data.id=1002' })]) assert.throws(() => verifyWebhook(request, mpConfig.webhookSecret, now), error => error.status === 401);
  const request = signedRequest('1001'); request.headers.append('x-signature', 'ts=1234567890,v1=' + 'a'.repeat(64));
  assert.throws(() => verifyWebhook(request, mpConfig.webhookSecret, now));
});

test('webhook no exige Origin pero sí firma, consulta el pago y no confía en estado del cuerpo', async () => {
  const f = await ready(); f.remote.set('1001', remotePayment(f.checkout, { status: 'pending', date_approved: null }));
  assert.equal((await f.notify('1001', { secret: 'wrong' })).status, 401);
  assert.equal(f.events.size, 0);
  const response = await f.notify('1001', { body: { type: 'payment', data: { id: '1001' }, status: 'approved', url: 'http://internal.example' } });
  assert.equal(response.status, 200); assert.equal(currentPayment(f.orders.get(f.purchase.order.id).data).status, 'pending');
  assert.equal(f.outbound.at(-1).url, 'https://api.mercadopago.com/v1/payments/1001');
  assert.equal((await f.notify('1001', { body: { type: 'payment', data: { id: '9999' } } })).status, 401);
});

test('webhook verifica monto, moneda, receptor y entorno antes de registrar una venta', async () => {
  const f = await ready();
  for (const invalid of [{ transaction_amount: 1 }, { currency_id: 'USD' }, { collector_id: 222 }, { live_mode: true }, { id: 999 }]) {
    f.remote.set('1001', remotePayment(f.checkout, invalid)); assert.equal((await f.notify('1001')).status, 422);
  }
  assert.equal(f.events.size, 0); assert.equal(canPrepareOrder(f.orders.get(f.purchase.order.id).data), false);
});

test('aprobación verificada habilita preparación, conserva fecha real y no duplica ventas al repetir notificaciones', async () => {
  const f = await ready(); f.remote.set('1001', remotePayment(f.checkout));
  assert.equal((await f.notify('1001')).status, 200); const row = f.orders.get(f.purchase.order.id); const revision = row.revision;
  assert.equal(canPrepareOrder(row.data), true); assert.equal(currentPayment(row.data).approvedAt, '2026-10-17T12:03:00.000Z');
  await Promise.all([f.notify('1001'), f.notify('1001')]);
  assert.equal(f.events.size, 1); assert.equal(row.revision, revision); assert.equal(selectSales([row.data]).length, 1);
});

test('rechazo y reintento se registran sobre el mismo pedido sin duplicar la venta', async () => {
  const f = await ready(); f.remote.set('1001', remotePayment(f.checkout, { status: 'rejected', date_approved: null }));
  await f.notify('1001'); assert.equal(currentPayment(f.orders.get(f.purchase.order.id).data).status, 'rejected');
  f.remote.set('1002', remotePayment(f.checkout, { id: 1002 })); await f.notify('1002');
  const order = f.orders.get(f.purchase.order.id).data;
  assert.equal(order.payments.filter(payment => payment.providerTransactionId).length, 2);
  assert.equal(order.payments.filter(payment => payment.approvedAt).length, 1); assert.equal(selectSales([order]).length, 1);
});

test('reembolso completo conserva venta y aprobación aunque su notificación llegue primero', async () => {
  const f = await ready(); f.remote.set('1001', remotePayment(f.checkout, { status: 'refunded', transaction_amount_refunded: 9990 }));
  assert.equal((await f.notify('1001')).status, 200);
  const order = f.orders.get(f.purchase.order.id).data;
  assert.equal(currentPayment(order).status, 'refunded'); assert.ok(currentPayment(order).approvedAt);
  assert.equal(canPrepareOrder(order), false); assert.equal(selectSales([order]).length, 1);
});

test('parciales, contracargos y cobros adicionales quedan en revisión y no habilitan despacho', async () => {
  for (const overrides of [{ status: 'approved', transaction_amount_refunded: 1000 }, { status: 'charged_back' }]) {
    const f = await ready(); f.remote.set('1001', remotePayment(f.checkout, overrides)); await f.notify('1001');
    const order = f.orders.get(f.purchase.order.id).data;
    assert.equal(order.paymentReviewRequired, true); assert.equal(canPrepareOrder(order), false);
  }
  const f = await ready(); f.remote.set('1001', remotePayment(f.checkout)); await f.notify('1001');
  f.remote.set('1002', remotePayment(f.checkout, { id: 1002 })); await f.notify('1002');
  const order = f.orders.get(f.purchase.order.id).data;
  assert.equal(order.paymentReviewRequired, true); assert.equal(selectSales([order]).length, 1); assert.equal(canPrepareOrder(order), false);
});

test('instantáneas antiguas no retroceden pagos y las carreras se reintentan sobre el registro actualizado', async () => {
  const f = await ready(); f.remote.set('1001', remotePayment(f.checkout)); await f.notify('1001');
  const row = f.orders.get(f.purchase.order.id);
  const stale = remotePayment(f.checkout, { status: 'pending', date_last_updated: '2026-10-17T12:02:00Z' });
  assert.equal(reconcilePayment(row.data, stale, f.checkout, mpConfig, paymentTime).ignored, true);
  const other = await ready(); const rpc = other.db.rpc; let conflict = true;
  other.db.rpc = async (name, args) => {
    if (name === 'commit_payment' && conflict) { conflict = false; const current = other.orders.get(other.purchase.order.id); current.revision++; current.data.comments.push({ id: 'concurrent', text: 'Comentario simultáneo' }); const error = new Error('Concurrent'); error.status = 409; throw error; }
    return rpc(name, args);
  };
  other.remote.set('1001', remotePayment(other.checkout)); assert.equal((await other.notify('1001')).status, 200);
  assert.equal(other.orders.get(other.purchase.order.id).data.comments.at(-1).id, 'concurrent');
});
