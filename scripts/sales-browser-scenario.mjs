import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

export async function runSalesScenario({ evaluate, waitFor, click, navigate, send }) {
  const fill = (label, value) => evaluate(`(() => {
    const node = [...document.querySelectorAll('label')].find(el => el.textContent.trim() === ${JSON.stringify(label)});
    if (!node) throw Error('Campo no encontrado: ' + ${JSON.stringify(label)});
    const input = document.getElementById(node.htmlFor);
    const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  const selectType = (value) => evaluate(`(() => { const el = document.querySelector('.sales-query-form select'); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const openSale = async () => {
    await waitFor("!!document.querySelector('.sales-list__entry')");
    await evaluate("document.querySelector('.sales-list__entry').click()");
    await waitFor("document.body.innerText.includes('Pago de la venta')");
  };
  await evaluate(`(async () => {
    const { services } = await import('/src/services/index.js');
    const { createMockAdapter } = await import('/src/services/mock.js');
    const { products } = await import('/src/data/products.js');
    const { createOrder, recordPaymentUpdate, changeOrderLifecycle } = await import('/src/modules/orders/model.js');
    const { businessDate } = await import('/src/shared/businessDates.js');
    const at = new Date().toISOString();
    const system = { id: 'system', name: 'Pagos de prueba', role: 'system' };
    const admin = { id: 'demo-admin', name: 'Administración demo', role: 'admin' };
    window.salesPreviousDate = (Number(businessDate().slice(0, 4)) - 1) + '-02-14';
    const create = (id, number, name, slug, status = 'approved', paidAt = at) => {
      let order = { ...createOrder({ id, number, createdAt: new Date(Date.parse(paidAt) - 10 * 86400000).toISOString(), shippingFee: 3000, catalog: products,
        items: [{ slug, format: '1 kg', quantity: 1 }], draft: { buyer: { name, email: id + '@example.com', phone: '+56912345678' }, recipientSameAsBuyer: true, recipient: {}, shippingAddress: { street: 'Calle 123', commune: 'Pucón', apartment: '12', reference: 'Entrada lateral' }, deliveryInstructions: 'Llamar antes de entregar' }
      }), isTest: true };
      if (status !== 'pending') order = recordPaymentUpdate(order, { paymentId: order.payments[0].id, status: status === 'refunded' ? 'approved' : status, at: paidAt, transactionId: 'tx-' + id, author: system });
      if (status === 'refunded') order = recordPaymentUpdate(order, { paymentId: order.payments[0].id, status: 'refunded', at: paidAt, author: system });
      return order;
    };
    let closed = create('closed-sale', 'CM-CLOSED', 'Compra archivada', 'miel-de-cerezo');
    closed = changeOrderLifecycle(closed, { action: 'cancel', reason: 'Cancelado', author: admin, at });
    closed = changeOrderLifecycle(closed, { action: 'archive', reason: 'Cerrado', author: admin, at });
    const adapter = createMockAdapter({ initialOrders: [
      create('shared-sale', 'CM-SHARED', 'Venta compartida', 'miel-multifloral'),
      create('refunded-sale', 'CM-REFUND', 'Compra reembolsada', 'miel-de-cerezo', 'refunded'), closed,
      create('pending-sale', 'CM-PENDING', 'Compra pendiente', 'miel-multifloral', 'pending'),
      create('rejected-sale', 'CM-REJECTED', 'Compra rechazada', 'miel-multifloral', 'rejected'),
      create('historical-sale', 'CM-HISTORY', 'Compra anterior', 'miel-de-avellana', 'approved', window.salesPreviousDate + 'T12:00:00Z')
    ] });
    await adapter.auth.login({ email: 'admin@casamiel.demo', password: 'demo1234' });
    Object.assign(services, adapter);
    window.salesTestApi = services;
  })()`);
  await navigate("/staff/admin/ventas");
  await waitFor("document.body.innerText.includes('Elige una consulta para comenzar')");
  assert.equal(await evaluate("!!document.querySelector('.sales-results')"), false);
  await click("Actualizar ventas");
  await waitFor("!document.querySelector('.sales-refresh button').disabled");
  await click("Hoy");
  await waitFor("document.querySelectorAll('.sales-list__entry').length === 3");
  assert.equal(await evaluate("document.querySelector('[data-sales-approved-total]').innerText.replace(/\\D/g, '')"), "21990");
  assert.equal(await evaluate("document.querySelector('[data-sales-refunded-total]').innerText.replace(/\\D/g, '')"), "12000");
  assert.equal(await evaluate("document.querySelector('.sales-results').innerText.includes('CM-PENDING')"), false);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  await writeFile(".preview-browser/sales-mobile.png", Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const label of ["Esta semana", "Este mes"]) {
    await click(label);
    await waitFor("document.querySelectorAll('.sales-list__entry').length === 3");
  }
  await click("Elegir fecha o período");
  assert.equal(await evaluate("!!document.querySelector('.sales-results')"), false);
  await selectType("range");
  const previous = await evaluate("window.salesPreviousDate");
  await fill("Fecha inicial", previous);
  await fill("Fecha final", "2000-01-01");
  await click("Consultar ventas");
  await waitFor("document.body.innerText.includes('no puede preceder')");
  await fill("Fecha final", previous);
  await click("Consultar ventas");
  await waitFor("document.querySelectorAll('.sales-list__entry').length === 1 && document.querySelector('.sales-list').innerText.includes('CM-HISTORY')");
  await selectType("month");
  await fill("Mes de la venta", previous.slice(0, 7));
  await click("Consultar ventas");
  await waitFor("document.querySelector('.sales-list')?.innerText.includes('CM-HISTORY')");
  await selectType("week");
  await fill("Elige un día de la semana", previous);
  await click("Consultar ventas");
  await waitFor("document.querySelector('.sales-list')?.innerText.includes('CM-HISTORY')");
  await selectType("day");
  await fill("Fecha de la venta", previous);
  await click("Consultar ventas");
  await waitFor("document.querySelector('.sales-list')?.innerText.includes('CM-HISTORY')");
  await click("Buscar venta");
  await click("Consultar ventas");
  await waitFor("!!document.querySelector('[aria-invalid=true]')");
  await fill("Número de pedido, pago o comprador", "tx-shared-sale");
  await click("Consultar ventas");
  await waitFor("document.querySelectorAll('.sales-list__entry').length === 1 && document.querySelector('.sales-list').innerText.includes('CM-SHARED')");
  await openSale();
  await fill("Comentario", "Coordinación desde ventas");
  await click("Guardar comentario");
  await waitFor("document.body.innerText.includes('Coordinación desde ventas') && document.body.innerText.includes('Comentario interno agregado')");
  await click("Abrir pedido relacionado");
  await waitFor("document.body.innerText.includes('Gestión del pedido')");
  assert.ok(await evaluate("document.body.innerText.includes('Coordinación desde ventas')"));
  await click("Marcar entregado");
  await waitFor("!!document.querySelector('dialog[open]')");
  await evaluate("document.querySelector('dialog[open] .commerce-button--primary').click()");
  await waitFor("document.body.innerText.includes('Entrega registrada:')");
  await navigate("/staff/admin/ventas/shared-sale");
  await waitFor("document.body.innerText.includes('Pago de la venta') && document.body.innerText.includes('Entregado')");
  await click("← Volver a ventas");
  await waitFor("document.querySelector('input[type=search]')?.value === 'tx-shared-sale'");
  assert.equal(await evaluate("document.querySelectorAll('.sales-list__entry').length"), 1);
  const shared = await evaluate("window.salesTestApi.orders.getById('shared-sale')");
  assert.equal(shared.comments.length, 1);
  assert.equal(shared.payments.length, 1);
  assert.equal(shared.delivery.status, "delivered");
  await fill("Número de pedido, pago o comprador", "no-existe");
  await click("Consultar ventas");
  await waitFor("document.body.innerText.includes('No hay ventas para esta consulta')");
  await click("Hoy");
  await evaluate("window.salesOriginalList = window.salesTestApi.orders.list; window.salesTestApi.orders.list = async () => { throw Error('Fallo de consulta de prueba'); }");
  await click("Actualizar ventas");
  await waitFor("document.body.innerText.includes('No pudimos consultar los pagos')");
  assert.equal(await evaluate("!!document.querySelector('.sales-list')"), false);
  await evaluate("window.salesTestApi.orders.list = window.salesOriginalList");
  await click("Actualizar ventas");
  await waitFor("document.querySelectorAll('.sales-list__entry').length === 3");
  await click("Cerrar sesión");
  await waitFor("document.body.innerText.includes('Cuentas de demostración')");
  await click("Usar cuenta delivery");
  await click("Iniciar sesión");
  await waitFor("location.pathname === '/staff/delivery'");
  await navigate("/staff/admin/ventas/shared-sale");
  await waitFor("document.body.innerText.includes('Acceso denegado')");
  assert.equal(await evaluate("document.body.innerText.includes('Venta compartida')"), false);
  console.log("Navegador ventas: consultas cerradas, períodos actuales y anteriores, rangos inválidos, totales/reembolsos, búsqueda de pago, comentario compartido y entrega actualizada, filtros al volver, vacío/error/reintento, móvil y acceso denegado a delivery verificados.");
}
