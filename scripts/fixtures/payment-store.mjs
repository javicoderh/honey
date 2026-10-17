import { createHmac, randomUUID } from 'node:crypto';
import { setup, draft } from './backend-store.mjs';
import { createApplication } from '../../server/application.mjs';
import { createMercadoPagoClient } from '../../server/mercadopago/client.mjs';
import { HttpError } from '../../server/errors.mjs';

export const paymentTime = '2026-10-17T12:05:00.000Z';
export const mpConfig = { enabled: true, environment: 'sandbox', accessToken: 'local-test-access-token', webhookSecret: 'local-test-webhook-secret', collectorId: '12345' };
export function signedRequest(id, { secret = mpConfig.webhookSecret, ts = String(Date.parse(paymentTime)), requestId = 'request-123', body, query = '' } = {}) {
  const signature = createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
  return new Request(`https://honey.example/api?route=payments%2Fwebhook&data.id=${id}&type=payment${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${signature}` }, body: JSON.stringify(body ?? { type: 'payment', data: { id } }) });
}

export function setupPayments({ enabled = true, providerFetch } = {}) {
  const base = setup(); const checkouts = new Map(); const events = new Map(); const remote = new Map(); const outbound = [];
  const originalRpc = base.db.rpc;
  base.db.checkout = async attempt => structuredClone([...checkouts.values()].find(row => row.attempt_id === attempt) ?? null);
  base.db.rpc = async (name, args) => {
    if (!['reserve_checkout','finish_checkout','uncertain_checkout','commit_payment'].includes(name)) return originalRpc(name, args);
    base.db.calls.push([name, structuredClone(args)]);
    if (name === 'reserve_checkout') {
      const previous = checkouts.get(args.p_order_id);
      if (previous) { if (previous.state === 'ready') return structuredClone(previous); throw new HttpError(409, 'Preparación pendiente de revisión.'); }
      const checkout = { order_id: args.p_order_id, attempt_id: randomUUID(), owner: args.p_owner, state: 'creating', expires_at: '2026-10-18T12:00:00.000Z' };
      checkouts.set(args.p_order_id, checkout); return structuredClone(checkout);
    }
    if (name === 'finish_checkout') {
      const checkout = checkouts.get(args.p_order_id);
      if (checkout.owner !== args.p_owner || checkout.state !== 'creating') throw new HttpError(409, 'Checkout cambiado.');
      Object.assign(checkout, { state: 'ready', preference_id: args.p_preference_id, checkout_url: args.p_url }); return null;
    }
    if (name === 'uncertain_checkout') { const checkout = checkouts.get(args.p_order_id); if (checkout.owner === args.p_owner && checkout.state === 'creating') checkout.state = 'uncertain'; return null; }
    const row = base.orders.get(args.p_order_id);
    if (events.has(args.p_event.id)) return structuredClone(row.data);
    if (row.revision !== args.p_revision) throw new HttpError(409, 'Actualiza el registro.');
    row.data = structuredClone(args.p_order); row.revision++; events.set(args.p_event.id, structuredClone(args.p_event)); return structuredClone(row.data);
  };
  const client = createMercadoPagoClient({ ...mpConfig, enabled }, { origin: 'https://honey.example', fetcher: async (url, options) => {
    outbound.push({ url, options });
    if (providerFetch) return providerFetch(url, options);
    if (url.endsWith('/checkout/preferences')) return new Response(JSON.stringify({ id: 'preference-1', collector_id: 12345, sandbox_init_point: 'https://sandbox.mercadopago.cl/checkout/v1/redirect?pref_id=preference-1', init_point: 'https://www.mercadopago.cl/checkout/v1/redirect?pref_id=preference-1' }));
    const data = remote.get(url.split('/').at(-1)); return new Response(JSON.stringify(data ?? {}), { status: data ? 200 : 404 });
  } });
  const app = createApplication({ db: base.db, config: { origin: 'https://honey.example', orderSecret: 'a'.repeat(64), shippingFee: 3000, communes: ['Pucón'], mercadoPago: { ...mpConfig, enabled } }, now: () => paymentTime, paymentClient: client });
  const call = async (route, { body, token, cookie, id } = {}) => {
    const params = new URLSearchParams({ route, ...(id ? { id } : {}) });
    const response = await app(new Request(`https://honey.example/api?${params}`, { method: body ? 'POST' : 'GET', headers: { Origin: 'https://honey.example', 'Content-Type': 'application/json', ...(token ? { 'X-Order-Token': token } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }));
    return { status: response.status, data: await response.json() };
  };
  // La compra se crea a las 12:00; la confirmación ocurre después, a las 12:05.
  const purchase = async () => (await base.call('orders/create', { method: 'POST', body: { requestId: randomUUID(), draft: draft(), items: [{ slug: 'miel-multifloral', format: '1 kg', quantity: 1 }] } })).data;
  const notify = async (id, options) => { const response = await app(signedRequest(id, options)); return { status: response.status, data: await response.json() }; };
  return { ...base, app, call, purchase, notify, client, checkouts, events, remote, outbound };
}

export function remotePayment(checkout, overrides = {}) {
  return { id: 1001, external_reference: checkout.attempt_id, collector_id: 12345, live_mode: false, currency_id: 'CLP', transaction_amount: 9990, transaction_amount_refunded: 0, status: 'approved', date_created: '2026-10-17T12:01:00.000Z', date_last_updated: '2026-10-17T12:04:00.000Z', date_approved: '2026-10-17T12:03:00.000Z', ...overrides };
}
