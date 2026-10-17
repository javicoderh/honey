import { createHash, randomUUID } from 'node:crypto';
import { createApplication } from '../../server/application.mjs';
import { HttpError } from '../../server/errors.mjs';
import { products } from '../../src/data/products.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const adminId = '11111111-1111-4111-8111-111111111111';
const deliveryId = '22222222-2222-4222-8222-222222222222';
const fixedTime = '2026-10-17T12:00:00.000Z';
const draft = () => ({ buyer: { name: 'Ana', email: 'ana@example.cl', phone: '+56911111111' }, recipientSameAsBuyer: true, shippingAddress: { street: 'Calle 123', commune: 'Pucón' } });

export function setup(overrides = {}, now = () => fixedTime) {
  const members = [{ id: adminId, name: 'Admin', email: 'admin@example.cl', role: 'admin', active: true }, { id: deliveryId, name: 'Delivery', email: 'delivery@example.cl', role: 'delivery', active: true }].map(member => ({ ...member, accessVersion: 0, createdAt: fixedTime, updatedAt: fixedTime, history: [] }));
  const sessions = new Map(); const orders = new Map(); const requests = new Map(); const calls = [];
  const db = {
    calls, members: async () => structuredClone(members), member: async id => structuredClone(members.find(member => member.id === id) ?? null),
    catalog: async () => structuredClone(products),
    session: async token => { const session = sessions.get(token); const member = members.find(member => member.id === session?.member.id); return member?.active && member.accessVersion === session.version ? { member: structuredClone(member), expiresAt: session.expiresAt } : null; },
    saveSession: async (token, member, expiresAt) => { sessions.set(token, { member, expiresAt, version: member.accessVersion }); },
    deleteSession: async token => { sessions.delete(token); },
    signIn: async email => ({ user: { id: members.find(member => member.email === email)?.id } }),
    createUser: async () => ({ id: randomUUID() }), deleteUser: async id => { calls.push(['deleteUser', id]); },
    order: async id => structuredClone(orders.get(id) ?? null),
    orders: async id => structuredClone([...orders.values()].map(row => row.data).filter(order => !id || order.delivery.assignedTo === id)),
    rpc: async (name, args) => {
      calls.push([name, structuredClone(args)]);
      if (name === 'new_order') {
        if (requests.has(args.p_request_hash)) return structuredClone(orders.get(requests.get(args.p_request_hash)).data);
        const order = { ...args.p_order, number: `CM-${orders.size + 1}` };
        requests.set(args.p_request_hash, order.id); orders.set(order.id, { data: order, revision: 0, capability_hash: args.p_capability_hash }); return structuredClone(order);
      }
      if (name === 'commit_order') { const row = orders.get(args.p_id); if (row.revision !== args.p_revision) throw new HttpError(409, 'Actualiza el registro.'); row.revision++; row.data = args.p_order; return structuredClone(row.data); }
      if (name === 'commit_staff') { const index = members.findIndex(member => member.id === args.p_member.id); if (index < 0) members.push(args.p_member); else members[index] = args.p_member; return structuredClone(args.p_member); }
    },
  };
  const app = createApplication({ db, now, config: { origin: 'https://honey.example', orderSecret: 'a'.repeat(64), shippingFee: 3000, communes: ['Pucón'], ...overrides } });
  const call = async (route, { method = 'GET', body, cookie, token, headers = {} } = {}) => {
    const response = await app(new Request(`https://honey.example/api?${route.startsWith('route=') ? route : new URLSearchParams({ route })}`, { method, headers: { Origin: 'https://honey.example', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { 'X-Order-Token': token } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    return { status: response.status, headers: response.headers, data: await response.json() };
  };
  const login = async (email = 'admin@example.cl') => call('login', { method: 'POST', body: { email, password: 'password-only-for-test' } });
  return { app, call, login, db, orders, members, sessions };
}

export { digest, adminId, deliveryId, fixedTime, draft };
