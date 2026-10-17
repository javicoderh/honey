import test from "node:test";
import assert from "node:assert/strict";
import { createDemoAuth } from "../src/services/demoAuth.js";
import { canAccessStaff, staffHome } from "../src/modules/staff/access.js";

test("login demo valida credenciales y asigna cada rol sin guardar contraseñas en la sesión", async () => {
  const auth = createDemoAuth();
  assert.equal(await auth.getSession(), null);
  await assert.rejects(auth.login({ email: "admin@casamiel.demo", password: "incorrecta" }), /incorrectos/);
  await assert.rejects(auth.login({ email: "otro@example.com", password: "demo1234" }), /incorrectos/);
  for (const role of ["admin", "delivery"]) {
    const session = await auth.login({ email: ` ${role.toUpperCase()}@casamiel.demo `, password: "demo1234" });
    assert.equal(session.role, role);
    assert.equal(session.password, undefined);
    assert.equal(staffHome(session.role), `/staff/${role}`);
    session.name = "Alteración local";
    assert.notEqual((await auth.getSession()).name, "Alteración local");
    await auth.logout();
    assert.equal(await auth.getSession(), null);
  }
});

test("sesión demo vence a los 30 minutos y se puede volver a ingresar", async () => {
  let now = Date.parse("2026-10-17T12:00:00Z");
  const auth = createDemoAuth({ now: () => now });
  const credentials = { email: "admin@casamiel.demo", password: "demo1234" };
  await auth.login(credentials);
  now += 30 * 60 * 1000 - 1;
  assert.ok(await auth.getSession());
  now++;
  assert.equal(await auth.getSession(), null);
  assert.equal((await auth.login(credentials)).role, "admin");
  assert.equal(await createDemoAuth().getSession(), null);
});

test("navegación por rol impide abrir secciones ajenas o rutas parecidas", () => {
  for (const path of ["/staff/admin", "/staff/admin/pedidos", "/staff/admin/ventas", "/staff/admin/despachos", "/staff/admin/equipo"]) {
    assert.equal(canAccessStaff("admin", path), true);
    assert.equal(canAccessStaff("delivery", path), false);
    assert.equal(canAccessStaff(null, path), false);
  }
  assert.equal(canAccessStaff("delivery", "/staff/delivery"), true);
  assert.equal(canAccessStaff("admin", "/staff/delivery"), false);
  assert.equal(canAccessStaff("delivery", "/staff/delivery-otro"), false);
  assert.equal(canAccessStaff("admin", "/staff/administrator"), false);
  assert.equal(staffHome("unknown"), "/staff");
});
