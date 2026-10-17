export function validateCheckoutUrl(value, environment) {
  if (!['sandbox', 'production'].includes(environment)) throw new Error('El entorno de pago no es válido.');
  let url; try { url = new URL(value); } catch { throw new Error('El enlace de pago no es válido.'); }
  const host = environment === 'sandbox' ? 'sandbox.mercadopago.cl' : 'www.mercadopago.cl';
  if (url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password || !url.pathname.startsWith('/checkout/')) throw new Error('El enlace de pago no es válido.');
  return url.href;
}
