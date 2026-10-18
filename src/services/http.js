export function createHttpAdapter({ fetcher = fetch, base = '/api', getReference = () => typeof window === 'undefined' ? '' : window.location.hash } = {}) {
  const references = new Map();
  const accessToken = id => {
    if (references.has(id)) return references.get(id);
    const match = /^#pedido=([a-f\d-]{36})\.([a-f\d]{64})$/.exec(getReference());
    return match?.[1] === id ? match[2] : null;
  };
  const call = async (route, { body, id, token, query } = {}) => {
    const params = new URLSearchParams({ route, ...(id ? { id } : {}), ...query });
    let response;
    try { response = await fetcher(`${base}?${params}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { 'X-Order-Token': token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch { throw new Error('No pudimos confirmar la conexión. Intenta nuevamente.'); }
    const data = await response.json().catch(() => null);
    if (!response.ok) { const error = new Error(data?.error ?? 'No pudimos completar la operación.'); error.status = response.status; throw error; }
    return data;
  };
  return {
    mode: 'api',
    savedCart: {
      capture: input=>call('carts/capture',{body:input}),
      sync: input=>call('carts/touch',{body:input}),
      recover: reference=>call('carts/recover',{body:{reference}}),
      unsubscribe: reference=>call('carts/unsubscribe',{body:{reference}}),
    },
    marketing: {
      list: query=>call('marketing/list',{query}),
      export: segment=>call('marketing/export',{query:{segment}}),
      unsubscribe: contactId=>call('marketing/unsubscribe',{body:{contactId}}),
    },
    catalog: { list: () => call('catalog') },
    checkout: { quote: draft => call('quote', { body: { draft } }) },
    auth: { getSession: () => call('session'), login: credentials => call('login', { body: credentials }), logout: () => call('logout', { body: {} }) },
    orders: {
      create: async input => { const { order, accessToken } = await call('orders/create', { body: input }); references.set(order.id, accessToken); return order; },
      list: () => call('orders'), listAssigned: () => call('orders/assigned'),
      getById: id => call('order', { id, token: accessToken(id) }),
      update: (id, command) => call('orders/update', { body: { id, command } }),
      privateReference: id => accessToken(id) ? `#pedido=${id}.${accessToken(id)}` : null,
    },
    payments: { getForOrder: id => call('payment', { id, token: accessToken(id) }), capabilities: () => call('payments/capabilities'), start: id => call('payments/start', { body: { orderId: id }, token: accessToken(id) }) },
    staff: { list: () => call('staff'), create: ({ password, ...draft }) => call('staff/create', { body: { draft, password } }), update: (id, changes) => call('staff/update', { body: { id, changes } }) },
  };
}
