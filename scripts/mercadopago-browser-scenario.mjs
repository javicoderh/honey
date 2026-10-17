import assert from 'node:assert/strict';

export async function runMercadoPagoBrowserScenario({ evaluate, waitFor, click, reference, reload }) {
  await evaluate(`history.replaceState({}, '', '/checkout/resultado?status=approved&collection_status=approved&payment_id=1001' + ${JSON.stringify(reference)})`);
  await reload();
  await waitFor("document.body.innerText.includes('Pago pendiente de confirmación')");
  assert.equal(await evaluate("document.body.innerText.includes('Pago confirmado')"), false);
  // Solo se sustituyen respuestas en esta prueba de interfaz; no hay salidas al proveedor.
  await evaluate(`(() => {
    window.originalMpFetch = window.fetch;
    window.mpBrowser = { mode: 'unsafe', starts: 0, verified: false };
    window.fetch = async (input, options) => {
      const url = new URL(input, location.origin);
      const route = url.searchParams.get('route');
      const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
      if (route === 'payments/capabilities') return json({ enabled: true });
      if (route === 'payments/start') {
        window.mpBrowser.starts++;
        window.mpBrowser.hasReference = /^[a-f0-9]{64}$/.test(options.headers['X-Order-Token']);
        if (window.mpBrowser.mode === 'error') return json({ error: 'Preparación pendiente de revisión.' }, 409);
        return new Promise(resolve => { window.resolveMpBrowser = () => resolve(json({ checkoutUrl: 'https://evil.example/checkout/', environment: 'sandbox' })); });
      }
      const response = await window.originalMpFetch(input, options);
      if (route === 'payment' && window.mpBrowser.holdNext) {
        window.mpBrowser.holdNext = false;
        return new Promise(resolve => { window.releaseMpStatus = () => resolve(response); });
      }
      if (route === 'payment' && window.mpBrowser.verified) {
        const payment = await response.json();
        return json({ ...payment, status: 'approved', approvedAt: new Date().toISOString() });
      }
      return response;
    };
  })()`);
  await evaluate("(async () => { const { services } = await import('/src/services/index.js'); const { createHttpAdapter } = await import('/src/services/http.js'); Object.assign(services, createHttpAdapter({ fetcher: (...args) => window.fetch(...args) })); })()");
  // Remontar el panel para consultar las capacidades ficticias de esta prueba.
  await evaluate("history.pushState({}, '', '/productos'); window.dispatchEvent(new PopStateEvent('popstate'))");
  await waitFor("location.pathname === '/productos' && !document.body.innerText.includes('Estado de tu compra')");
  await evaluate(`history.pushState({}, '', '/checkout/resultado' + ${JSON.stringify(reference)}); window.dispatchEvent(new PopStateEvent('popstate'))`);
  await waitFor("[...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Pagar con Mercado Pago' && !el.disabled)");
  await click('Pagar con Mercado Pago');
  await waitFor("document.body.innerText.includes('Preparando pago…')");
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Preparando pago…').disabled"), true);
  await evaluate('window.resolveMpBrowser()');
  await waitFor("document.body.innerText.includes('El enlace de pago no es válido.')");
  assert.equal(await evaluate('window.mpBrowser.starts'), 1);
  assert.equal(await evaluate('window.mpBrowser.hasReference'), true);
  assert.equal(await evaluate('location.pathname'), '/checkout/resultado');
  await evaluate('window.mpBrowser.holdNext = true');
  await click('Consultar estado del pago');
  await waitFor("typeof window.releaseMpStatus === 'function'");
  assert.equal(await evaluate("document.body.innerText.includes('Pago pendiente de confirmación')"), true);
  await evaluate('window.releaseMpStatus()');
  await waitFor("[...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Pagar con Mercado Pago' && !el.disabled)");
  await evaluate("window.mpBrowser.mode = 'error'");
  await click('Pagar con Mercado Pago');
  await waitFor("document.body.innerText.includes('Preparación pendiente de revisión.')");
  await evaluate('window.mpBrowser.verified = true');
  await click('Consultar estado del pago');
  await waitFor("document.body.innerText.includes('Pago confirmado')");
  assert.equal(await evaluate("[...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Pagar con Mercado Pago')"), false);
  await evaluate('window.fetch = window.originalMpFetch');
  console.log('Navegador Mercado Pago: parámetros falsos no aprueban pagos; botón, bloqueo de doble envío, referencia privada, error recuperable, redirección insegura bloqueada y confirmación desde respuesta consultada verificados con datos locales.');
}
