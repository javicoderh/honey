import { randomUUID } from 'node:crypto';
import { HttpError, insist } from '../errors.mjs';
import { createMercadoPagoClient, paymentId, preferenceBody } from './client.mjs';
import { reconcilePayment } from './reconcile.mjs';

export function createPaymentIntegration({ db, config, origin, now, client = createMercadoPagoClient(config, { origin }) }) {
  return {
    ready: client.ready,
    async start(row, capability) {
      insist(client.ready, 503, 'El pago en línea todavía no está habilitado.');
      const owner = randomUUID();
      const checkout = await db.rpc('reserve_checkout', { p_order_id: row.data.id, p_owner: owner });
      if (checkout.state === 'ready') return { checkoutUrl: client.url(checkout.checkout_url), environment: config.environment };
      try {
        const body = preferenceBody(row.data, checkout, { origin, capability });
        const preference = await client.createPreference(body, checkout.attempt_id);
        insist(typeof preference.id === 'string' && preference.id.length < 200 && (!preference.collector_id || paymentId(preference.collector_id) === config.collectorId), 502, 'No se pudo verificar la preferencia de pago.');
        const url = client.url(config.environment === 'sandbox' ? preference.sandbox_init_point : preference.init_point);
        await db.rpc('finish_checkout', { p_order_id: row.data.id, p_owner: owner, p_preference_id: preference.id, p_url: url });
        return { checkoutUrl: url, environment: config.environment };
      } catch (error) {
        // Una desconexión puede haber creado la preferencia: no crear otra a ciegas.
        await db.rpc('uncertain_checkout', { p_order_id: row.data.id, p_owner: owner }).catch(() => {});
        throw error;
      }
    },
    async webhook(request, body) {
      const id = client.verify(request, Date.parse(now()));
      if (body.data?.id !== undefined) insist(paymentId(body.data.id) === id, 401, 'Identificador de notificación inconsistente.');
      const topic = new URL(request.url).searchParams.get('type') ?? body.type;
      if (topic !== 'payment') return { received: true, ignored: true };
      const remote = await client.getPayment(id);
      insist(paymentId(remote.id) === id, 422, 'El proveedor devolvió otro pago.');
      if (typeof remote.external_reference !== 'string' || !/^[a-f\d-]{36}$/i.test(remote.external_reference)) return { received: true, ignored: true };
      const checkout = await db.checkout(remote.external_reference);
      if (!checkout) return { received: true, ignored: true };
      for (let attempt = 0; attempt < 3; attempt++) {
        const row = await db.order(checkout.order_id);
        insist(row, 409, 'El pedido todavía no está disponible.');
        const reconciled = reconcilePayment(row.data, remote, checkout, config, now());
        if (reconciled.ignored) return { received: true };
        try {
          await db.rpc('commit_payment', { p_order_id: checkout.order_id, p_revision: row.revision, p_order: reconciled.order, p_event: reconciled.event });
          return { received: true };
        } catch (error) { if (error.status !== 409 || attempt === 2) throw error; }
      }
      throw new HttpError(503, 'No se pudo registrar el pago.');
    },
  };
}
