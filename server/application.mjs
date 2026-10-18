import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { HttpError, insist } from "./errors.mjs";
import { createOrder, updateOrderOperations, recordDeliveryUpdate, assignOrderDelivery, addOrderComment, changeOrderLifecycle, canPrepareOrder } from "../src/modules/orders/model.js";
import { createTeamMember, updateTeamMember } from "../src/modules/staff/model.js";
import { currentPayment } from "../src/modules/payments/model.js";
import { deliveryView } from "../src/modules/deliveries/selectors.js";
import { sanitizeCart } from "../src/modules/cart/model.js";
import { validateCheckout } from "../src/modules/purchase/checkout.js";
import { isValidEmail } from "../src/shared/validation.js";
import { createPaymentIntegration } from './mercadopago/integration.mjs';
import { marketingRequest, cartReference } from './marketing.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const safeMember = member => { const { accessVersion, ...publicData } = member; return publicData; };
const publicPayment = payment => payment ? Object.fromEntries(['id','orderId','status','amount','currency','createdAt','updatedAt','approvedAt','refundedAt','reviewRequired'].map(key => [key, payment[key]])) : null;
const publicOrder = order => ({ ...Object.fromEntries(['id','number','currency','buyer','recipient','shippingAddress','deliveryInstructions','items','subtotal','shippingFee','total','createdAt','updatedAt','cancelledAt'].map(key => [key, order[key]])), payments: order.payments.map(publicPayment), delivery: { status: order.delivery.status, deliveredAt: order.delivery.deliveredAt } });
const privateToken = request => request.headers.get('x-order-token') ?? '';
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,150}$/.test(value);
function shipping(draft, config) {
  const commune = draft?.shippingAddress?.commune?.trim().toLocaleLowerCase('es-CL');
  insist(Number.isSafeInteger(config.shippingFee) && config.shippingFee >= 0 && config.communes?.length, 503, 'La cobertura y tarifa de despacho aún no están configuradas.');
  insist(config.communes.some(value => value.trim().toLocaleLowerCase('es-CL') === commune), 422, 'Todavía no tenemos cobertura para esa comuna.');
  return config.shippingFee;
}

export function createApplication({ db, config, now = () => new Date().toISOString(), paymentClient }) {
  insist(config.origin && new URL(config.origin).origin === config.origin && config.orderSecret?.length >= 32, 503, 'Falta configurar el origen y la clave privada de pedidos.');
  const secure = config.origin.startsWith('https:');
  const cookieName = secure ? '__Host-honey_session' : 'honey_session';
  const cookie = (value, maxAge) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  const payments = createPaymentIntegration({ db, config: config.mercadoPago, origin: config.origin, now, ...(paymentClient ? { client: paymentClient } : {}) });
  return async request => {
    let headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
    try {
      const url = new URL(request.url);
      const route = url.searchParams.get('route') ?? '';
      const method = request.method;
      insist(['GET', 'POST'].includes(method), 405, 'Método no permitido.');
      if (method === 'POST') {
        if (route !== 'payments/webhook') insist(request.headers.get('origin') === config.origin && request.headers.get('sec-fetch-site') !== 'cross-site', 403, 'Origen no permitido.');
        insist(request.headers.get('content-type')?.split(';')[0] === 'application/json', 415, 'Envía datos JSON.');
      }
      let body = {};
      if (method === 'POST') {
        const raw = await request.text();
        insist(Buffer.byteLength(raw) <= 32768, 413, 'El formulario supera el tamaño permitido.');
        try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'El formulario no contiene JSON válido.'); }
        insist(body && typeof body === 'object' && !Array.isArray(body), 400, 'Formulario inválido.');
      }
      if (route === 'payments/webhook' && method === 'POST') return new Response(JSON.stringify(await payments.webhook(request, body)), { status: 200, headers });
      const token = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? '';
      const sessionHash = /^[a-f0-9]{64}$/.test(token) ? hash(token) : null;
      const session = sessionHash ? await db.session(sessionHash) : null;
      const actor = session?.member;
      const requireRole = role => insist(actor?.active && (!role || actor.role === role), actor ? 403 : 401, 'Necesitas una sesión con permisos para continuar.');
      const rate = async (scope, limit) => {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
        await db.rpc('rate_limit', { p_key: hash(`${scope}:${ip}`), p_limit: limit });
      };
      let result;
      if (route.startsWith('carts/') || route.startsWith('marketing/')) result = await marketingRequest({ route,method,body,url,db,config,sessionHash,requireRole,rate });
      else if (route === 'catalog' && method === 'GET') result = await db.catalog();
      else if (route === 'payments/capabilities' && method === 'GET') result = { enabled: payments.ready };
      else if (route === 'payments/start' && method === 'POST') {
        insist(payments.ready, 503, 'El pago en línea todavía no está habilitado.');
        insist(actor?.role !== 'delivery', 403, 'Tu sesión no permite gestionar pagos.');
        await rate('checkout', 30);
        insist(validId(body.orderId), 404, 'Pedido no disponible.');
        const row = await db.order(body.orderId); const capability = privateToken(request);
        insist(row?.capability_hash && /^[a-f0-9]{64}$/.test(capability) && timingSafeEqual(Buffer.from(row.capability_hash, 'hex'), Buffer.from(hash(capability), 'hex')), 404, 'Pedido no disponible.');
        insist(!row.data.cancelledAt && !row.data.archivedAt && !row.data.paymentReviewRequired && !row.data.payments.some(payment => payment.approvedAt), 409, 'Este pedido no admite un nuevo pago. Consulta su estado.');
        result = await payments.start(row, capability);
      }
      else if (route === 'quote' && method === 'POST') result = { shippingFee: shipping(body.draft, config) };
      else if (route === 'session' && method === 'GET') result = actor ? { ...safeMember(actor), history: undefined, expiresAt: session.expiresAt } : null;
      else if (route === 'login' && method === 'POST') {
        await rate('login', 20);
        insist(isValidEmail(body.email) && typeof body.password === 'string' && body.password.length <= 256, 422, 'Revisa correo y contraseña.');
        const auth = await db.signIn(body.email.trim().toLowerCase(), body.password);
        const member = await db.member(auth.user?.id);
        insist(member?.active && ['admin', 'delivery'].includes(member.role), 401, 'No se pudo iniciar sesión. Revisa tus datos y el estado de tu cuenta.');
        const rawToken = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.parse(now()) + 30 * 60000).toISOString();
        if (sessionHash) await db.deleteSession(sessionHash);
        await db.saveSession(hash(rawToken), member, expiresAt);
        headers['Set-Cookie'] = cookie(rawToken, 1800);
        result = { id: member.id, name: member.name, email: member.email, role: member.role, active: true, expiresAt };
      } else if (route === 'logout' && method === 'POST') {
        if (sessionHash) await db.deleteSession(sessionHash);
        headers['Set-Cookie'] = cookie('', 0); result = null;
      } else if (route === 'orders/create' && method === 'POST') {
        await rate('purchase', 30);
        insist(typeof body.requestId === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(body.requestId), 422, 'Referencia de compra inválida.');
        insist(!Object.keys(validateCheckout(body.draft)).length, 422, 'Revisa los datos obligatorios, correo y teléfonos.');
        const items = sanitizeCart(body.items);
        insist(items.length > 0 && items.length <= 30, 422, 'Revisa los productos del carrito.');
        const capability = createHmac('sha256', config.orderSecret).update(body.requestId).digest('hex');
        const order = createOrder({ id: randomUUID(), number: 'PENDING', createdAt: now(), draft: body.draft, items, catalog: await db.catalog(), shippingFee: shipping(body.draft, config) });
        const savedReference = body.savedCart ? cartReference(body.savedCart) : null;
        result = await db.rpc(savedReference ? 'new_order_with_cart' : 'new_order', { p_request_hash: hash(body.requestId), p_capability_hash: hash(capability), p_order: order,
          ...(savedReference ? { p_cart_id: savedReference.p_id, p_cart_hash: savedReference.p_hash } : {}) });
        result = { order: publicOrder(result), accessToken: capability };
      } else if (route === 'orders' && method === 'GET') { requireRole('admin'); result = await db.orders(); }
      else if (route === 'orders/assigned' && method === 'GET') { requireRole('delivery'); result = (await db.orders(actor.id)).filter(order => canPrepareOrder(order)).map(deliveryView); }
      else if (['order', 'payment'].includes(route) && method === 'GET') {
        const id = url.searchParams.get('id'); insist(validId(id), 404, 'Pedido no disponible.');
        const row = await db.order(id);
        const capability = privateToken(request);
        const expected = row?.capability_hash;
        const permitted = actor?.role === 'admin' || (expected && /^[a-f0-9]{64}$/.test(capability) && timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hash(capability), 'hex')));
        insist(row && permitted && actor?.role !== 'delivery', 404, 'Pedido no disponible.');
        result = route === 'payment' ? (actor?.role === 'admin' ? { ...currentPayment(row.data), reviewRequired: Boolean(row.data.paymentReviewRequired) } : publicPayment({ ...currentPayment(row.data), reviewRequired: Boolean(row.data.paymentReviewRequired) })) : actor?.role === 'admin' ? row.data : publicOrder(row.data);
      } else if (route === 'orders/update' && method === 'POST') {
        requireRole(); insist(validId(body.id), 404, 'Pedido no disponible.');
        const row = await db.order(body.id); insist(row, 404, 'Pedido no disponible.');
        const { type, payload = {} } = body.command ?? {};
        if (actor.role === 'delivery') insist(['delivery', 'comment'].includes(type) && row.data.delivery.assignedTo === actor.id && canPrepareOrder(row.data), 403, 'Esta entrega no está disponible para tu sesión.');
        else requireRole('admin');
        const args = { ...payload, at: now(), author: actor };
        let next;
        if (type === 'operations') next = updateOrderOperations(row.data, args);
        else if (type === 'comment') next = addOrderComment(row.data, { ...args, id: randomUUID() });
        else if (type === 'delivery') next = recordDeliveryUpdate(row.data, args);
        else if (type === 'assign') next = assignOrderDelivery(row.data, { ...args, assignee: await db.member(payload.deliveryId) });
        else if (['cancel', 'archive'].includes(type)) next = changeOrderLifecycle(row.data, { ...args, action: type });
        else throw new HttpError(422, 'Acción no disponible. Los registros reales se conservan.');
        result = await db.rpc('commit_order', { p_hash: sessionHash, p_id: body.id, p_revision: row.revision, p_order: next, p_type: type });
        if (actor.role === 'delivery') result = deliveryView(result);
      } else if (route === 'staff' && method === 'GET') { requireRole('admin'); result = (await db.members()).map(safeMember); }
      else if (route === 'staff/create' && method === 'POST') {
        requireRole('admin'); await rate('staff', 30);
        insist(typeof body.password === 'string' && body.password.length >= 12 && body.password.length <= 128 && body.password !== 'demo1234', 422, 'Usa una contraseña de 12 a 128 caracteres para la nueva cuenta.');
        const members = await db.members();
        // Validar antes de crear la identidad de autenticación externa.
        createTeamMember(members, { id: randomUUID(), draft: body.draft, author: actor, at: now() });
        const user = await db.createUser(body.draft.email.trim().toLowerCase(), body.password);
        const id = user.id ?? user.user?.id;
        insist(validId(id), 503, 'No se pudo crear la identidad de la cuenta.');
        try {
          const member = createTeamMember(members, { id, draft: body.draft, author: actor, at: now() });
          result = safeMember(await db.rpc('commit_staff', { p_hash: sessionHash, p_member: member, p_expected_version: null }));
        } catch (error) { await db.deleteUser(id).catch(() => {}); throw error; }
      } else if (route === 'staff/update' && method === 'POST') {
        requireRole('admin'); const members = await db.members();
        const before = members.find(member => member.id === body.id);
        const member = updateTeamMember(members, body.id, { changes: body.changes, author: actor, at: now() });
        result = safeMember(await db.rpc('commit_staff', { p_hash: sessionHash, p_member: member, p_expected_version: before.accessVersion }));
      } else throw new HttpError(404, 'Operación no encontrada.');
      return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 422;
      return new Response(JSON.stringify({ error: status >= 500 ? 'El servicio no está disponible. Intenta nuevamente más tarde.' : error instanceof TypeError || error instanceof RangeError ? 'Revisa los datos enviados.' : error.message || 'Revisa los datos enviados.' }), { status, headers });
    }
  };
}
