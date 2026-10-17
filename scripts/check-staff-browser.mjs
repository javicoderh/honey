import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createServer } from "vite";

const server = await createServer({ server: { host: "127.0.0.1", port: 5179, strictPort: true }, logLevel: "error" });
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
let browser;
let socket;
let sequence = 0;
const requests = new Map();
const errors = [];
try {
  await server.listen();
  browser = spawn(process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-extensions", "--disable-background-networking", "--no-first-run", "--remote-debugging-port=9231", `--user-data-dir=${resolve(".preview-browser/staff-check")}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  browser.on("error", (error) => errors.push(error.message));
  let pages;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { pages = await (await fetch("http://127.0.0.1:9231/json/list")).json(); if (pages.some((page) => page.type === "page")) break; } catch {}
    await delay(250);
  }
  const page = pages?.find((entry) => entry.type === "page");
  assert.ok(page, `No se pudo iniciar Edge: ${errors.join(" ")}`);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const pending = requests.get(message.id);
      if (!pending) return;
      requests.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  });
  await new Promise((done, reject) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  const send = (method, params = {}) => new Promise((done, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { requests.delete(id); reject(new Error(`Tiempo agotado: ${method}`)); }, 10000);
    requests.set(id, { resolve: (value) => { clearTimeout(timer); done(value); }, reject: (cause) => { clearTimeout(timer); reject(cause); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 80; attempt++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(`No se cumplió: ${expression}\n${await evaluate("document.body.innerText")}`);
  };
  const click = (text) => evaluate(`(() => { const el = [...document.querySelectorAll('button,a')].find(el => el.textContent.trim() === ${JSON.stringify(text)}); if (!el) throw Error('Control no encontrado'); el.click(); })()`);
  const navigate = async (path) => { await evaluate(`history.pushState({}, '', ${JSON.stringify(path)}); window.dispatchEvent(new PopStateEvent('popstate'))`); };
  await send("Page.navigate", { url: "http://127.0.0.1:5179/staff/admin/ventas" });
  await send("Runtime.enable");
  await waitFor("document.body.innerText.includes('Inicia sesión para continuar')");
  await click("Iniciar sesión");
  await waitFor("document.body.innerText.includes('Cuentas de demostración')");
  await click("Usar cuenta admin");
  await click("Iniciar sesión");
  await waitFor("location.pathname === '/staff/admin' && document.body.innerText.includes('2 integrantes activos')");
  assert.equal(await evaluate("!!document.querySelector('.record-list')"), false);
  if (process.argv.includes("--orders")) {
    const { runOrdersScenario } = await import("./orders-browser-scenario.mjs");
    await runOrdersScenario({ evaluate, waitFor, click, navigate, send });
  } else {
  await evaluate("document.querySelector('a[href=\"/staff/admin/pedidos\"]').click()");
  await waitFor("!!document.querySelector('input[type=search]')");
  await evaluate("(() => { const el = document.querySelector('input[type=search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'DEMO-42'); el.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await click("← Volver al panel");
  await waitFor("location.pathname === '/staff/admin'");
  await evaluate("document.querySelector('a[href=\"/staff/admin/pedidos\"]').click()");
  await waitFor("document.querySelector('input[type=search]')?.value === 'DEMO-42'");
  await click("Cerrar sesión");
  await waitFor("location.pathname === '/staff' && document.body.innerText.includes('Sesión cerrada')");
  await click("Usar cuenta delivery");
  await click("Iniciar sesión");
  await waitFor("location.pathname === '/staff/delivery' && document.body.innerText.includes('Pendientes de entrega (0)')");
  assert.equal(await evaluate("!!document.querySelector('.delivery-section')"), false);
  assert.equal(await evaluate("!!document.querySelector('a[href=\"/staff/admin/ventas\"]')"), false);
  await click("Pendientes de entrega (0)");
  await waitFor("document.body.innerText.includes('Sin entregas pendientes')");
  await navigate("/staff/admin/equipo");
  await waitFor("document.body.innerText.includes('Acceso denegado')");
  assert.equal(await evaluate("document.body.innerText.includes('admin@casamiel.demo')"), false);
  await click("Ir a mi panel");
  await waitFor("document.body.innerText.includes('Sin entregas pendientes')");
  await evaluate("window.originalNow = Date.now; Date.now = () => window.originalNow() + 31 * 60 * 1000");
  await waitFor("document.body.innerText.includes('Tu sesión venció')");
  await evaluate("Date.now = window.originalNow");
  await click("Iniciar sesión");
  await waitFor("document.body.innerText.includes('Cuentas de demostración')");
  assert.deepEqual(errors, []);
  console.log("Navegador: login de ambos roles, logout, contadores, listas cerradas, búsqueda conservada, acceso denegado y vencimiento verificados.");
  }
  assert.deepEqual(errors, []);
  await send("Browser.close").catch(() => {});
} finally {
  socket?.close();
  browser?.kill();
  await server.close();
}
