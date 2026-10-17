import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

export async function runOrdersScenario({ evaluate, waitFor, click, navigate, send }) {
  const fill = (label, value) => evaluate(`(() => {
    const node = [...document.querySelectorAll('label')].find(el => el.textContent.trim() === ${JSON.stringify(label)});
    if (!node) throw Error('Campo no encontrado: ' + ${JSON.stringify(label)});
    const input = document.getElementById(node.htmlFor);
    const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  const confirm = () => evaluate("document.querySelector('dialog[open] .commerce-button--primary').click()");
  const openOrder = async () => {
    await waitFor("!!document.querySelector('.order-list__entry')");
    await evaluate("document.querySelector('.order-list__entry').click()");
    await waitFor("document.body.innerText.includes('Gestión del pedido')");
  };
  await evaluate(`(async () => {
    window.orderTestApi = (await import('/src/services/index.js')).services;
    window.orderTestOrder = await window.orderTestApi.orders.create({ requestId: 'browser-orders', draft: {
      buyer: { name: 'Compradora Navegador', email: 'browser@example.com', phone: '+56912345678' },
      recipientSameAsBuyer: true, recipient: {}, shippingAddress: { street: 'Calle 123', commune: 'Pucón', apartment: '12', reference: 'Entrada lateral' },
      deliveryInstructions: 'Dejar con conserjería'
    }, items: [{ slug: 'miel-multifloral', format: '1 kg', quantity: 1 }] });
    await window.orderTestApi.payments.simulate(window.orderTestOrder.id, 'approved');
  })()`);
  await navigate("/staff/admin/pedidos");
  await waitFor("!!document.querySelector('input[type=search]')");
  await click("Actualizar pedidos");
  await openOrder();
  assert.equal(await evaluate("!!document.querySelector('input[type=number]')"), false);
  await click("Corregir datos de entrega");
  await fill("Departamento / casa / oficina", "21");
  await fill("Indicaciones operativas", "Llamar al llegar");
  await fill("Motivo de corrección", "Corrección solicitada por comprador");
  await click("Revisar corrección");
  await waitFor("!!document.querySelector('dialog[open]')");
  assert.match(await evaluate("document.querySelector('dialog[open]').innerText"), /12.*21/s);
  await confirm();
  await waitFor("document.body.innerText.includes('Datos de entrega corregidos') && !document.querySelector('dialog[open]')");
  const corrected = await evaluate("window.orderTestApi.orders.getById(window.orderTestOrder.id)");
  assert.equal(corrected.shippingAddress.apartment, "21");
  assert.equal(corrected.originalDeliveryInstructions, "Dejar con conserjería");
  assert.equal(corrected.total, 9990);
  assert.equal(corrected.items[0].unitPrice, 6990);
  await fill("Comentario", "Coordinado por teléfono");
  await click("Guardar comentario");
  await waitFor("document.body.innerText.includes('Comentario interno agregado')");
  await click("Marcar entregado");
  await waitFor("!!document.querySelector('dialog[open]')");
  await confirm();
  await waitFor("document.body.innerText.includes('Entrega registrada:')");
  await click("Marcar pendiente");
  await waitFor("!!document.querySelector('dialog[open]')");
  await confirm();
  await waitFor("document.body.innerText.includes('Indica un motivo para continuar.')");
  await fill("Motivo", "Confirmación equivocada");
  await confirm();
  await waitFor("document.body.innerText.includes('Fecha de entrega anterior conservada:')");
  await click("Entrega no realizada");
  await waitFor("!!document.querySelector('dialog[open]')");
  await fill("Motivo", "Destinatario ausente");
  await confirm();
  await waitFor("document.body.innerText.includes('Destinatario ausente') && !document.querySelector('dialog[open]')");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  await writeFile(".preview-browser/orders-mobile.png", Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  await click("← Volver a pedidos");
  await waitFor("!!document.querySelector('input[type=search]')");
  await evaluate("(() => { const el = document.querySelector('input[type=search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Navegador'); el.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await openOrder();
  await click("← Volver a pedidos");
  await waitFor("document.querySelector('input[type=search]')?.value === 'Navegador'");
  await openOrder();
  await click("Cancelar pedido");
  await waitFor("!!document.querySelector('dialog[open]')");
  await fill("Motivo", "Cancelación solicitada");
  await confirm();
  await waitFor("document.body.innerText.includes('Pedido cancelado') && !document.querySelector('dialog[open]')");
  assert.equal((await evaluate("window.orderTestApi.orders.getById(window.orderTestOrder.id)")).payments[0].status, "approved");
  await click("Archivar pedido");
  await waitFor("!!document.querySelector('dialog[open]')");
  await fill("Motivo", "Gestión cerrada");
  await confirm();
  await waitFor("document.body.innerText.includes('Pedido archivado') && !document.querySelector('dialog[open]')");
  await click("← Volver a pedidos");
  await waitFor("!!document.querySelector('input[type=search]')");
  await click("Todos");
  assert.equal(await evaluate("!!document.querySelector('.order-list__entry')"), false);
  await evaluate("document.querySelector('.order-checkbox input').click()");
  await openOrder();
  await click("Eliminar registro de prueba");
  await waitFor("!!document.querySelector('dialog[open]')");
  await confirm();
  await waitFor("location.pathname === '/staff/admin/pedidos' && document.body.innerText.includes('Registro de prueba eliminado.')");
  assert.equal(await evaluate("window.orderTestApi.orders.getById(window.orderTestOrder.id)"), null);
  console.log("Navegador pedidos: detalle, corrección confirmada, importes intactos, comentario, entrega y corrección con fecha anterior, entrega fallida, filtros conservados, cancelación sin reembolso, archivo y borrado de prueba; ancho móvil sin desbordamiento.");
}
