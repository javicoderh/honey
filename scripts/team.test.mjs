import test from "node:test";
import assert from "node:assert/strict";
import { createMockAdapter } from "../src/services/mock.js";
import { createDemoAuth } from "../src/services/demoAuth.js";
import { validateTeamDraft } from "../src/modules/staff/model.js";
import { products } from "../src/data/products.js";
import { createOrder, recordPaymentUpdate } from "../src/modules/orders/model.js";

const login = (api, email = "admin@casamiel.demo") => api.auth.login({ email, password: "demo1234" });
const draft = (email = "new@casamiel.demo", role = "delivery") => ({ name: "Integrante nuevo", email, role });

test("validación por campo, correo normalizado y duplicados incluso en cuentas inactivas", async () => {
  assert.deepEqual(Object.keys(validateTeamDraft({})).sort(), ["email", "name", "role"]);
  const api = createMockAdapter(); await login(api);
  const member = await api.staff.create(draft(" NEW@CASAMIEL.DEMO "));
  assert.equal(member.email, "new@casamiel.demo");
  await assert.rejects(api.staff.create(draft("New@casamiel.demo")), /Ya existe/);
  await api.staff.update(member.id, { active: false });
  await assert.rejects(api.staff.create(draft()), /Ya existe/);
  for (const invalid of [{ ...draft(), role: "consumer" }, { ...draft(), name: " " }, { ...draft(), email: "incorrecto" }, { ...draft(), active: true }]) await assert.rejects(api.staff.create(invalid));
});

test("solo admin activo puede leer o gestionar equipo; no expone credenciales en registros", async () => {
  const api = createMockAdapter();
  for (const operation of [() => api.staff.list(), () => api.staff.create(draft()), () => api.staff.update("demo-admin", { active: false })]) await assert.rejects(operation(), /administración/);
  await login(api, "delivery@casamiel.demo");
  for (const operation of [() => api.staff.list(), () => api.staff.create(draft()), () => api.staff.update("demo-admin", { role: "delivery" })]) await assert.rejects(operation(), /administración/);
  await login(api);
  const member = await api.staff.create(draft());
  assert.equal(member.password, undefined);
  assert.equal(member.accessVersion, undefined);
  const listed = await api.staff.list(); listed[0].name = "Modificado fuera";
  assert.notEqual((await api.staff.list())[0].name, "Modificado fuera");
  assert.equal(member.history[0].author.id, "demo-admin");
});

test("cuentas nuevas de ambos roles pueden ingresar con la contraseña ficticia", async () => {
  const api = createMockAdapter(); await login(api);
  const courier = await api.staff.create(draft("courier@casamiel.demo"));
  const admin = await api.staff.create(draft("second@casamiel.demo", "admin"));
  const courierSession = await login(api, courier.email);
  assert.equal(courierSession.role, "delivery");
  assert.equal(courierSession.history, undefined);
  assert.equal((await login(api, admin.email)).role, "admin");
});

test("último admin activo no puede desactivarse ni cambiar rol; un admin inactivo no cuenta", async () => {
  const api = createMockAdapter(); await login(api);
  await assert.rejects(api.staff.update("demo-admin", { active: false }), /al menos un admin/);
  await assert.rejects(api.staff.update("demo-admin", { role: "delivery" }), /al menos un admin/);
  const second = await api.staff.create(draft("second@casamiel.demo", "admin"));
  await api.staff.update(second.id, { active: false });
  await assert.rejects(api.staff.update("demo-admin", { role: "delivery", active: false }), /al menos un admin/);
  assert.equal((await api.staff.list()).filter((member) => member.active && member.role === "admin").length, 1);
});

test("cambio de rol propio invalida la sesión anterior y exige ingreso con permisos nuevos", async () => {
  const api = createMockAdapter(); await login(api);
  await api.staff.create(draft("second@casamiel.demo", "admin"));
  const changed = await api.staff.update("demo-admin", { role: "delivery" });
  assert.equal(changed.role, "delivery");
  assert.equal(await api.auth.getSession(), null);
  await assert.rejects(api.staff.list(), /administración/);
  const session = await login(api);
  assert.equal(session.role, "delivery");
  await assert.rejects(api.staff.create(draft()), /administración/);
  assert.equal(api.auth.demoAccounts.find((entry) => entry.email === "admin@casamiel.demo").role, "delivery");
});

test("desactivación bloquea login y reactivación no restaura una sesión invalidada", async () => {
  const auth = createDemoAuth();
  await auth.login({ email: "admin@casamiel.demo", password: "demo1234" });
  const second = await auth.createMember(draft("second@casamiel.demo", "admin"));
  await auth.updateMember("demo-admin", { active: false });
  assert.equal(await auth.getSession(), null);
  await assert.rejects(auth.login({ email: "admin@casamiel.demo", password: "demo1234" }), /inactiva/);
  assert.ok(!auth.demoAccounts.some((entry) => entry.email === "admin@casamiel.demo"));
  await auth.login({ email: second.email, password: "demo1234" });
  await auth.updateMember("demo-admin", { active: true });
  assert.equal((await auth.getSession()).id, second.id);
  assert.equal((await auth.login({ email: "admin@casamiel.demo", password: "demo1234" })).role, "admin");
});

test("validación de cambios y actualizaciones repetidas preservan historial", async () => {
  const api = createMockAdapter(); await login(api);
  const member = await api.staff.create(draft());
  for (const changes of [{ role: "owner" }, { active: "false" }, { email: "changed@example.com" }, { id: "new-id" }, { accessVersion: 100 }, { history: [] }]) await assert.rejects(api.staff.update(member.id, changes));
  const result = await api.staff.update(member.id, { active: true, role: "delivery" });
  assert.equal(result.history.length, 1);
  const promoted = await api.staff.update(member.id, { role: "admin" });
  assert.equal(promoted.history.length, 2);
  assert.equal(promoted.history.at(-1).details.changes[0].before, "delivery");
  assert.equal(promoted.history.at(-1).author.id, "demo-admin");
  await assert.rejects(api.staff.update("missing", { active: false }), /no encontrado/);
});

test("desactivar delivery conserva asignaciones y bloquea nuevas asignaciones hasta reactivar", async () => {
  let source = createOrder({ id: "assignment", number: "CM-ASSIGNMENT", createdAt: "2020-01-01T12:00:00Z", shippingFee: 3000, catalog: products, items: [{ slug: "miel-multifloral", format: "1 kg", quantity: 1 }], draft: { buyer: { name: "Comprador", email: "buy@example.com", phone: "+56912345678" }, recipientSameAsBuyer: true, recipient: {}, shippingAddress: { street: "Calle 123", commune: "Pucón" }, deliveryInstructions: "Llamar" } });
  source = recordPaymentUpdate(source, { paymentId: source.payments[0].id, status: "approved", transactionId: "tx", at: "2020-01-02T12:00:00Z", author: { id: "system", name: "Pago", role: "system" } });
  const api = createMockAdapter({ initialOrders: [source] }); await login(api);
  const courier = await api.staff.create(draft());
  await api.orders.update(source.id, { type: "delivery", payload: { status: "ready" } });
  await api.orders.update(source.id, { type: "assign", payload: { deliveryId: courier.id } });
  await api.staff.update(courier.id, { active: false });
  assert.equal((await api.orders.getById(source.id)).delivery.assignedTo, courier.id);
  await assert.rejects(api.orders.update(source.id, { type: "assign", payload: { deliveryId: courier.id } }), /delivery activo/);
  await api.staff.update(courier.id, { active: true });
  await login(api, courier.email);
  assert.equal((await api.orders.listAssigned())[0].id, source.id);
});
