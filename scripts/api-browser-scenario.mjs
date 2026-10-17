import assert from 'node:assert/strict';

export async function runApiScenario({ evaluate, waitFor, click, navigate, send }) {
  const reload = async () => {
    await evaluate('window.apiReloadPending = true');
    await send('Page.reload');
    await waitFor("!window.apiReloadPending && document.readyState === 'complete'");
  };
  // Se usa el adaptador HTTP real con la API real y un repositorio de prueba en memoria.
  await evaluate("(async () => { const { services } = await import('/src/services/index.js'); const { createHttpAdapter } = await import('/src/services/http.js'); Object.assign(services, createHttpAdapter()); })()");
  await navigate('/staff');
  await waitFor("!!document.querySelector('input[type=email]')");
  const fill = (selector, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await fill('input[type=email]', 'admin@example.cl');
  await fill('input[type=password]', 'password-only-for-test');
  await click('Iniciar sesión');
  await waitFor("location.pathname === '/staff/admin'");
  assert.equal(await evaluate("document.cookie.includes('honey_session')"), false);
  await navigate('/staff/admin/equipo');
  await waitFor("document.querySelectorAll('.team-member').length === 2");
  await click('Crear integrante');
  await waitFor("!!document.querySelector('input[autocomplete=\"new-password\"]')");
  assert.equal(await evaluate("document.body.innerText.includes('demo1234')"), false);
  const fields = await evaluate("[...document.querySelectorAll('.team-form input')].map(el => el.id)");
  await fill(`[id="${fields[0]}"]`, 'Cuenta real de prueba');
  await fill(`[id="${fields[1]}"]`, 'real@example.cl');
  await fill('input[autocomplete="new-password"]', 'private-password-for-test');
  await click('Revisar nueva cuenta');
  await waitFor("!!document.querySelector('dialog[open]')");
  await evaluate("document.querySelector('dialog[open] .commerce-button--primary').click()");
  await waitFor("document.querySelectorAll('.team-member').length === 3");
  await click('Cerrar sesión');
  await waitFor("location.pathname === '/staff' && !!document.querySelector('input[type=email]')");
  await evaluate("localStorage.removeItem('casa-miel.cart.v1')");
  await navigate('/productos/miel-multifloral');
  await waitFor("[...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Agregar al carrito' && !el.disabled)");
  await click('Agregar al carrito');
  await navigate('/checkout');
  await waitFor("!!document.querySelector('input[name=\"buyer.name\"]')");
  await fill('input[name="buyer.name"]','Ana');
  await fill('input[name="buyer.email"]','ana@example.cl');
  await fill('input[name="buyer.phone"]','+56911111111');
  await fill('input[name="shippingAddress.street"]','Calle 123');
  await fill('input[name="shippingAddress.commune"]','Otra comuna');
  await waitFor("document.body.innerText.includes('Todavía no tenemos cobertura')");
  await fill('input[name="shippingAddress.commune"]','Pucón');
  await waitFor("document.body.innerText.includes('Despacho: $3.000')");
  await click('Crear pedido');
  await waitFor("location.pathname === '/checkout/resultado' && location.hash.startsWith('#pedido=')");
  assert.equal(await evaluate("document.body.innerText.includes('Simulador de pago')"), false);
  await waitFor("document.body.innerText.includes('Pago en línea aún no habilitado')");
  assert.equal(await evaluate("JSON.stringify(localStorage).includes('private-password-for-test')"), false);
  const reference = await evaluate('location.hash');
  const id = reference.slice('#pedido='.length).split('.')[0];
  assert.equal(await evaluate(`(async () => (await fetch('/api?route=order&id=${id}')).status)()`), 404);
  await reload();
  await waitFor("document.body.innerText.includes('Pago en línea aún no habilitado')");
  assert.equal(await evaluate('location.hash'), reference);
  if (process.argv.includes('--mercadopago')) {
    const { runMercadoPagoBrowserScenario } = await import('./mercadopago-browser-scenario.mjs');
    await runMercadoPagoBrowserScenario({ evaluate, waitFor, click, navigate, send, reference, reload });
  }
  await evaluate(`location.hash = '#pedido=${id}.${'b'.repeat(64)}'`);
  await reload();
  await waitFor("document.body.innerText.includes('La referencia privada no está disponible')");
  console.log('Navegador API: HTTP real con repositorio de prueba, cookie HttpOnly, alta staff sin contraseña demo, cobertura rechazada/aceptada, pedido privado y ausencia del simulador verificados.');
}
