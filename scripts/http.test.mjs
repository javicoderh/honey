import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpAdapter } from '../src/services/http.js';

test('adaptador HTTP conserva referencia en memoria y usa cabecera privada para consultar', async () => {
  const calls = [];
  const adapter = createHttpAdapter({ fetcher: async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify(url.includes('orders%2Fcreate') ? { order: { id: 'order-1' }, accessToken: 'private-reference' } : {})); } });
  assert.equal(adapter.mode, 'api'); assert.equal(adapter.payments.simulate, undefined);
  await adapter.orders.create({ requestId: 'request' }); await adapter.payments.getForOrder('order-1');
  assert.equal(calls[1].options.headers['X-Order-Token'], 'private-reference');
  assert.equal(calls[1].options.credentials, 'same-origin'); assert.equal(calls[1].url.includes('private-reference'), false);
});

test('referencia privada de URL restaura consultas sin almacenamiento del navegador', async () => {
  const id = '11111111-1111-4111-8111-111111111111'; let sent;
  const adapter = createHttpAdapter({ getReference: () => `#pedido=${id}.${'a'.repeat(64)}`, fetcher: async (url, options) => { sent = options.headers; return new Response('null'); } });
  await adapter.orders.getById(id); assert.equal(sent['X-Order-Token'], 'a'.repeat(64));
  await adapter.orders.getById('other'); assert.equal(sent['X-Order-Token'], undefined);
});

test('adaptador propaga errores HTTP y no cae a servicios demo', async () => {
  const adapter = createHttpAdapter({ fetcher: async () => new Response('{"error":"Sesión requerida"}', { status: 401 }) });
  await assert.rejects(adapter.orders.list(), error => error.status === 401 && error.message === 'Sesión requerida');
});
