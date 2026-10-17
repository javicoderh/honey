import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

export async function runTeamScenario({ evaluate, waitFor, click, navigate, send }) {
  const fill = (label, value) => evaluate(`(() => {
    const label = [...document.querySelectorAll('label')].find(el => el.textContent.trim() === ${JSON.stringify(label)});
    const input = document.getElementById(label.htmlFor);
    Object.getOwnPropertyDescriptor(input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  })()`);
  const confirm = async () => {
    await waitFor("!!document.querySelector('dialog[open]')");
    await evaluate("document.querySelector('dialog[open] .commerce-button--primary').click()");
    await waitFor("!document.querySelector('dialog[open]')");
  };
  const rowClick = (id, text) => evaluate(`([...document.querySelector('[data-member-id="${id}"]').querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(text)})).click()`);
  const openTeam = async () => {
    await navigate('/staff/admin/equipo');
    await waitFor("document.querySelectorAll('.team-member').length >= 2");
  };
  const create = async (name, email, role) => {
    await click('Crear integrante');
    await fill('Nombre del integrante', name);
    await fill('Correo del integrante', email);
    await fill('Rol del integrante', role);
    await click('Revisar nueva cuenta');
    await confirm();
    await waitFor(`document.querySelector('.team-list')?.innerText.includes(${JSON.stringify(email)})`);
  };
  const login = async (email) => {
    await fill('Correo', email);
    await fill('Contraseña', 'demo1234');
    await click('Iniciar sesión');
  };
  await openTeam();
  assert.equal(await evaluate("document.querySelector('[data-member-id=demo-admin] select').disabled"), true);
  await click('Crear integrante');
  await click('Revisar nueva cuenta');
  await waitFor("document.querySelectorAll('[aria-invalid=true]').length >= 2");
  await click('Cerrar alta');
  await create('Reparto nuevo', 'courier@casamiel.demo', 'delivery');
  const id = await evaluate("(async () => { const { services } = await import('/src/services/index.js'); return (await services.staff.list()).find(member => member.email === 'courier@casamiel.demo').id; })()");
  await click('Crear integrante');
  await fill('Nombre del integrante', 'Duplicado');
  await fill('Correo del integrante', 'courier@casamiel.demo');
  await click('Revisar nueva cuenta');
  await waitFor("document.body.innerText.includes('Ya existe una cuenta')");
  await click('Cerrar alta');
  await rowClick(id, 'Desactivar acceso');
  await confirm();
  await click('Inactivos');
  await waitFor("document.querySelectorAll('.team-member').length === 1");
  await rowClick(id, 'Reactivar acceso');
  await confirm();
  await waitFor("!document.querySelector('.team-member')");
  await click('Todos');
  await waitFor("document.querySelectorAll('.team-member').length === 3");
  await create('Otra admin', 'second@casamiel.demo', 'admin');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await writeFile('.preview-browser/team-mobile.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await fill('Rol de Administración demo', 'delivery');
  await rowClick('demo-admin', 'Revisar cambio de rol');
  await confirm();
  await waitFor("document.body.innerText.includes('Tu acceso cambió')");
  await click('Iniciar sesión');
  await login('admin@casamiel.demo');
  await waitFor("location.pathname === '/staff/delivery'");
  await navigate('/staff/admin/equipo');
  await waitFor("document.body.innerText.includes('Acceso denegado')");
  assert.equal(await evaluate("!!document.querySelector('.team-list')"), false);
  await click('Cerrar sesión');
  await waitFor("document.body.innerText.includes('Cuentas de demostración')");
  await login('second@casamiel.demo');
  await waitFor("location.pathname === '/staff/admin'");
  await openTeam();
  assert.equal(await evaluate("[...document.querySelectorAll('.team-member')].find(el => el.innerText.includes('second@casamiel.demo')).querySelector('select').disabled"), true);
  await fill('Rol de Reparto nuevo', 'admin');
  await rowClick(id, 'Revisar cambio de rol');
  await confirm();
  await waitFor(`document.querySelector('[data-member-id="${id}"]').innerText.includes('Admin · Activo')`);
  await evaluate(`document.querySelector('[data-member-id="${id}"] details').open = true`);
  assert.equal(await evaluate(`document.querySelector('[data-member-id="${id}"]').innerText.includes('Acceso actualizado')`), true);
  console.log('Navegador: altas, validación, duplicados, desactivación/reactivación, roles, historial, último admin, revocación propia, acceso denegado y móvil verificados.');
}
