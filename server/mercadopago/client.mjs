import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError, insist } from '../errors.mjs';
import { validateCheckoutUrl } from '../../src/modules/payments/checkoutUrl.js';

export const paymentId = value => typeof value === 'number' ? Number.isSafeInteger(value) && value > 0 ? String(value) : null : typeof value === 'string' && /^[1-9]\d{0,29}$/.test(value) ? value : null;
export function checkoutUrl(value, environment) {
  try { return validateCheckoutUrl(value, environment); } catch { throw new HttpError(502, 'El proveedor no devolvió un enlace de pago válido.'); }
}

export function verifyWebhook(request, secret, now = Date.now()) {
  const url = new URL(request.url);
  const id = paymentId(url.searchParams.get('data.id'));
  const requestId = request.headers.get('x-request-id');
  insist(id && url.searchParams.getAll('data.id').length === 1 && /^[a-zA-Z0-9_-]{1,200}$/.test(requestId ?? ''), 401, 'Notificación no autenticada.');
  const parts = (request.headers.get('x-signature') ?? '').split(',').map(value => value.trim().split('='));
  const tsParts = parts.filter(([key]) => key === 'ts'); const vParts = parts.filter(([key]) => key === 'v1');
  insist(tsParts.length === 1 && vParts.length === 1 && tsParts[0].length === 2 && vParts[0].length === 2, 401, 'Notificación no autenticada.');
  const ts = tsParts[0][1]; const signature = vParts[0][1];
  insist(/^(?:\d{10}|\d{13})$/.test(ts ?? '') && /^[a-f\d]{64}$/i.test(signature ?? ''), 401, 'Notificación no autenticada.');
  const timestamp = Number(ts) * (ts.length === 10 ? 1000 : 1);
  insist(Math.abs(now - timestamp) <= 5 * 60 * 1000, 401, 'Notificación fuera de la ventana de autenticación.');
  const expected = createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest();
  insist(timingSafeEqual(expected, Buffer.from(signature, 'hex')), 401, 'Notificación no autenticada.');
  return id;
}

export function createMercadoPagoClient(config = {}, { origin, fetcher = fetch } = {}) {
  const ready = config.enabled === true && ['sandbox','production'].includes(config.environment) && typeof config.accessToken === 'string' && config.accessToken.length > 0 && typeof config.webhookSecret === 'string' && config.webhookSecret.length > 0 && /^[1-9]\d{0,29}$/.test(config.collectorId ?? '') && /^https:\/\//.test(origin ?? '');
  const request = async (path, { body, key } = {}) => {
    insist(ready, 503, 'El pago en línea todavía no está habilitado.');
    let response;
    try { response = await fetcher(`https://api.mercadopago.com${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json', ...(key ? { 'X-Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(12000) }); }
    catch { throw new HttpError(503, 'No pudimos confirmar la comunicación con Mercado Pago.'); }
    const data = await response.json().catch(() => null);
    insist(response.ok && data && typeof data === 'object', 503, 'Mercado Pago no pudo completar la operación. Intenta consultar más tarde.');
    return data;
  };
  return { ready, config,
    createPreference: (body, key) => request('/checkout/preferences', { body, key }),
    getPayment: id => { insist(paymentId(id), 422, 'Identificador de pago inválido.'); return request(`/v1/payments/${id}`); },
    verify: (request, now) => { insist(ready, 503, 'El pago en línea todavía no está habilitado.'); return verifyWebhook(request, config.webhookSecret, now); },
    url: value => checkoutUrl(value, config.environment),
  };
}

export function preferenceBody(order, checkout, { origin, capability }) {
  insist(order.currency === 'CLP' && order.total > 0 && order.items.every(item => Number.isSafeInteger(item.unitPrice) && item.unitPrice > 0 && Number.isInteger(item.quantity) && item.quantity > 0), 422, 'El pedido tiene importes inválidos.');
  const amount = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) + order.shippingFee;
  insist(Number.isSafeInteger(amount) && amount === order.total, 422, 'El pedido tiene importes inconsistentes.');
  insist(/^[a-f\d]{64}$/.test(capability ?? ''), 404, 'Pedido no disponible.');
  const back = `${origin}/checkout/resultado#pedido=${order.id}.${capability}`;
  return {
    items: [...order.items.map(item => ({ id: `${item.productSlug}:${item.format}`, title: `${item.name} · ${item.format}`, quantity: item.quantity, unit_price: item.unitPrice, currency_id: 'CLP' })), ...(order.shippingFee > 0 ? [{ id: 'shipping', title: 'Despacho', quantity: 1, unit_price: order.shippingFee, currency_id: 'CLP' }] : [])],
    external_reference: checkout.attempt_id,
    back_urls: { success: back, failure: back, pending: back }, auto_return: 'approved',
    notification_url: `${origin}/api?route=payments%2Fwebhook`,
    expires: true, expiration_date_to: checkout.expires_at,
  };
}
