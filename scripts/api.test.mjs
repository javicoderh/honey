import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createApplication } from '../server/application.mjs';
import { HttpError } from '../server/errors.mjs';
import { createDatabase } from '../server/supabase.mjs';
import { products } from '../src/data/products.js';
import { createReviewOrders } from './fixtures/review-orders.mjs';

import { setup, digest, adminId, deliveryId, fixedTime, draft } from './fixtures/backend-store.mjs';

test('API rechaza origen ajeno, JSON incorrecto, carga excesiva y consultas sin permisos', async () => {
  const { call, app } = setup();
  const malformed = await app(new Request('https://honey.example/api?route=login', { method: 'POST', headers: { Origin: 'https://honey.example', 'Content-Type': 'application/json' }, body: '{broken' }));
  assert.equal(malformed.status, 400);
  assert.equal((await call('login', { method: 'POST', body: {}, headers: { Origin: 'https://other.example' } })).status, 403);
  assert.equal((await call('login', { method: 'POST', body: {}, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await call('login', { method: 'POST', body: { text: 'a'.repeat(33000) } })).status, 413);
  for (const route of ['orders', 'orders/assigned', 'staff']) assert.equal((await call(route)).status, 401);
  assert.equal((await call('payments/simulate', { method: 'POST', body: {} })).status, 404);
});

test('login usa cookie HttpOnly Secure, almacena solo hash y logout invalida acceso', async () => {
  const { call, login, sessions } = setup();
  const response = await login(); const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /__Host-honey_session=/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Strict/);
  const token = cookie.match(/=([a-f0-9]{64});/)[1];
  assert.equal(sessions.has(token), false); assert.equal(sessions.has(digest(token)), true);
  assert.equal(Object.hasOwn(response.data, 'accessVersion'), false);
  assert.equal((await call('staff', { cookie })).status, 200);
  assert.equal((await call('logout', { method: 'POST', cookie, body: {} })).status, 200);
  assert.equal((await call('staff', { cookie })).status, 401);
});

test('creación pública calcula importes en servidor, es idempotente y exige referencia privada', async () => {
  const { call, orders } = setup();
  const input = { requestId: randomUUID(), draft: draft(), items: [{ slug: 'miel-multifloral', format: '1 kg', quantity: 1, unitPrice: 1 }], total: 1, shippingFee: 0 };
  const first = await call('orders/create', { method: 'POST', body: input });
  assert.equal(first.status, 200); assert.equal(first.data.order.total, 9990); assert.equal(first.data.order.shippingFee, 3000);
  const again = await call('orders/create', { method: 'POST', body: input });
  assert.equal(orders.size, 1); assert.equal(first.data.order.id, again.data.order.id); assert.equal(first.data.accessToken, again.data.accessToken);
  const route = `route=order&id=${first.data.order.id}`;
  assert.equal((await call(route)).status, 404);
  assert.equal((await call(route, { token: 'a'.repeat(64) })).status, 404);
  assert.equal((await call(route, { token: first.data.accessToken })).status, 200);
  orders.get(first.data.order.id).data.comments.push({ id: 'private', text: 'Nota interna de staff' });
  const publicView = (await call(route, { token: first.data.accessToken })).data;
  assert.equal(Object.hasOwn(publicView, 'comments'), false);
  assert.equal(Object.hasOwn(publicView, 'history'), false);
  assert.equal(Object.hasOwn(publicView.delivery, 'assignedTo'), false);
  assert.equal((await call(`route=payment&id=${first.data.order.id}`, { token: first.data.accessToken })).data.status, 'pending');
});

test('servidor bloquea compras sin cobertura, tarifa, datos válidos o catálogo vigente', async () => {
  const input = { requestId: randomUUID(), draft: draft(), items: [{ slug: 'miel-multifloral', format: '1 kg', quantity: 1 }] };
  assert.equal((await setup({ shippingFee: null }).call('orders/create', { method: 'POST', body: input })).status, 503);
  const { call } = setup();
  const uncovered = structuredClone(input); uncovered.draft.shippingAddress.commune = 'Otra';
  assert.equal((await call('orders/create', { method: 'POST', body: uncovered })).status, 422);
  const invalid = structuredClone(input); invalid.draft.buyer.phone = '--------';
  assert.equal((await call('orders/create', { method: 'POST', body: invalid })).status, 422);
  input.items[0].quantity = 100;
  assert.equal((await call('orders/create', { method: 'POST', body: input })).status, 422);
});

test('delivery recibe proyección propia y no puede leer datos comerciales ni modificar pedidos ajenos', async () => {
  const { call, login, orders } = setup();
  const ready = createReviewOrders(fixedTime).find(order => order.id === 'review-ready'); ready.delivery.assignedTo = deliveryId;
  orders.set(ready.id, { data: ready, revision: 0 });
  const cookie = (await login('delivery@example.cl')).headers.get('set-cookie');
  for (const route of ['staff', 'orders']) assert.equal((await call(route, { cookie })).status, 403);
  const own = (await call('orders/assigned', { cookie })).data;
  assert.equal(own.length, 1); assert.equal(Object.hasOwn(own[0], 'buyer'), false); assert.equal(Object.hasOwn(own[0], 'payments'), false);
  assert.equal((await call(`route=order&id=${ready.id}`, { cookie })).status, 404);
  const result = await call('orders/update', { method: 'POST', cookie, body: { id: ready.id, command: { type: 'comment', payload: { text: 'Entrega coordinada', author: { id: adminId, role: 'admin' }, at: '2000-01-01' } } } });
  assert.equal(result.status, 200); assert.equal(result.data.comments.at(-1).author.id, deliveryId); assert.equal(result.data.comments.at(-1).createdAt, fixedTime);
  ready.delivery.assignedTo = adminId; orders.get(ready.id).data = ready;
  assert.equal((await call('orders/update', { method: 'POST', cookie, body: { id: ready.id, command: { type: 'delivery', payload: { status: 'delivered' } } } })).status, 403);
});

test('gestión staff exige contraseña segura, protege último admin y revoca cambios propios', async () => {
  const { call, login } = setup(); const cookie = (await login()).headers.get('set-cookie');
  const newMember = { name: 'Otra admin', email: 'other@example.cl', role: 'admin' };
  assert.equal((await call('staff/create', { method: 'POST', cookie, body: { draft: newMember, password: 'demo1234' } })).status, 422);
  assert.equal((await call('staff/update', { method: 'POST', cookie, body: { id: adminId, changes: { active: false } } })).status, 422);
  const created = await call('staff/create', { method: 'POST', cookie, body: { draft: newMember, password: 'unique-private-password' } });
  assert.equal(created.status, 200); assert.equal(Object.hasOwn(created.data, 'password'), false);
  assert.equal((await call('staff/update', { method: 'POST', cookie, body: { id: adminId, changes: { role: 'delivery' } } })).status, 200);
  assert.equal((await call('staff', { cookie })).status, 401);
});

test('cliente de base de datos no expone detalles ni claves en errores de proveedor', async () => {
  const db = createDatabase({ url: 'https://db.example', key: 'server-secret', fetcher: async () => new Response(JSON.stringify({ message: 'private detail server-secret' }), { status: 500 }) });
  await assert.rejects(db.catalog(), error => error.status === 503 && !error.message.includes('server-secret'));
  const limited = createDatabase({ url: 'https://db.example', key: 'server-secret', fetcher: async () => new Response(JSON.stringify({ code: 'P4290' }), { status: 400 }) });
  await assert.rejects(limited.rpc('rate_limit', {}), error => error.status === 429);
});
