export function readConfig(env = process.env) {
  return { origin: env.APP_ORIGIN, orderSecret: env.ORDER_ACCESS_SECRET,
    shippingFee: /^\d+$/.test(env.SHIPPING_FEE_CLP ?? '') ? Number(env.SHIPPING_FEE_CLP) : null,
    communes: (env.SHIPPING_COMMUNES ?? '').split(',').map(value => value.trim()).filter(Boolean),
    mercadoPago: { enabled: env.MP_ENABLED === 'true', environment: env.MP_ENVIRONMENT, accessToken: env.MP_ACCESS_TOKEN, webhookSecret: env.MP_WEBHOOK_SECRET, collectorId: env.MP_COLLECTOR_ID } };
}
