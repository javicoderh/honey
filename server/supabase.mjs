import { HttpError } from "./errors.mjs";

export function createDatabase({ url, key, fetcher = fetch }) {
  if (!url || !key || !/^https:\/\//.test(url)) throw new HttpError(503, "El backend todavía no está configurado.");
  const request = async (path, { method = "GET", body } = {}) => {
    let response;
    try { response = await fetcher(`${url.replace(/\/$/, "")}${path}`, { method, headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: "return=representation" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(12000) }); }
    catch { throw new HttpError(503, "No pudimos conectar con el servicio. Intenta nuevamente."); }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const messages = { "23505": [409, "Ya existe un registro con esos datos."], "40001": [409, "El registro cambió. Actualiza antes de guardar."], "P0001": [409, "No se pudo guardar el cambio. Actualiza el registro y revisa los permisos."], "42501": [403, "Tu sesión no permite esta operación."], "P4290": [429, "Demasiados intentos. Vuelve a intentarlo más tarde."] };
      messages.PMP01 = [409, 'La preparación del pago requiere revisión. No inicies otro pago hasta confirmar su estado.'];
      messages.P4040 = [404,'El enlace del carrito no está disponible.'];
      messages.P4100 = [410,'Este carrito guardado venció. Puedes guardar una nueva selección.'];
      messages.P4090 = [409,'Este carrito ya tiene un pedido o cambió su identidad. Usa el enlace de tu pedido o guarda una nueva selección.'];
      const [status, message] = messages[data?.code] ?? [response.status === 400 && path.startsWith('/auth/') ? 401 : 503, path.startsWith('/auth/') ? "No se pudo autenticar o crear la cuenta. Revisa los datos." : "El servicio no pudo completar la operación."];
      throw new HttpError(status, message);
    }
    return data;
  };
  const rpc = (name, body) => request(`/rest/v1/rpc/honey_${name}`, { method: "POST", body });
  return {
    rpc,
    signIn: (email, password) => request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }),
    createUser: (email, password) => request('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } }),
    deleteUser: id => request(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    member: async id => (await request(`/rest/v1/honey_staff?id=eq.${encodeURIComponent(id)}&select=data`))[0]?.data ?? null,
    members: async () => (await request('/rest/v1/honey_staff?select=data&order=id')).map(row => row.data),
    session: hash => rpc('session', { p_hash: hash }),
    saveSession: (hash, member, expiresAt) => request('/rest/v1/honey_sessions', { method: 'POST', body: { token_hash: hash, staff_id: member.id, access_version: member.accessVersion, expires_at: expiresAt } }),
    deleteSession: hash => request(`/rest/v1/honey_sessions?token_hash=eq.${hash}`, { method: 'DELETE' }),
    order: async id => (await request(`/rest/v1/honey_orders?id=eq.${encodeURIComponent(id)}&select=data,revision,capability_hash`))[0] ?? null,
    checkout: async attemptId => (await request(`/rest/v1/honey_checkout_sessions?attempt_id=eq.${encodeURIComponent(attemptId)}&select=*`))[0] ?? null,
    orders: async assignee => (await request(`/rest/v1/honey_orders?select=data${assignee ? `&data->delivery->>assignedTo=eq.${encodeURIComponent(assignee)}` : ''}&order=created_at.desc`)).map(row => row.data),
    catalog: async () => (await request('/rest/v1/honey_catalog?active=eq.true&select=data&order=slug')).map(row => row.data),
  };
}
