import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, watch: null, hmr: false },
});

try {
  const { services, createServices } = await server.ssrLoadModule("/src/services/index.js");
  const { resolvePurchaseRoute } = await server.ssrLoadModule("/src/modules/purchase/routes.jsx");
  const { resolveStaffRoute, StaffAccess, AdminDashboard } = await server.ssrLoadModule("/src/modules/staff/routes.jsx");
  const { default: SalesPage } = await server.ssrLoadModule("/src/modules/sales/SalesPage.jsx");
  const { DeliveryDashboard } = await server.ssrLoadModule("/src/modules/deliveries/DeliveriesPage.jsx");
  const { resolveStoreRoute } = await server.ssrLoadModule("/src/modules/store/routes.jsx");
  const { default: AppProviders } = await server.ssrLoadModule("/src/modules/AppProviders.jsx");
  const renderRoute = (pathname, route) => renderToStaticMarkup(createElement(AppProviders, { pathname }, route));
  const { useServices } = await server.ssrLoadModule("/src/services/ServicesContext.jsx");
  const { useCatalog } = await server.ssrLoadModule("/src/modules/store/CatalogContext.jsx");
  const { useCart } = await server.ssrLoadModule("/src/modules/cart/CartContext.jsx");
  const { usePurchase } = await server.ssrLoadModule("/src/modules/purchase/PurchaseContext.jsx");
  const { usePayment } = await server.ssrLoadModule("/src/modules/payments/PaymentContext.jsx");
  const { useSession } = await server.ssrLoadModule("/src/modules/staff/SessionContext.jsx");
  const { useOrders } = await server.ssrLoadModule("/src/modules/orders/OrdersContext.jsx");
  const { useTeam } = await server.ssrLoadModule("/src/modules/staff/TeamContext.jsx");

  function StoreProbe() {
    assert.deepEqual(useCart().items, []);
    assert.equal(usePurchase().draft.recipientSameAsBuyer, true);
    assert.equal(usePurchase().draft.deliveryInstructions, "");
    assert.equal(usePurchase().draft.buyer.name, "");
    assert.equal(typeof useCatalog().getProduct, "function");
    return null;
  }
  function PaymentProbe() {
    const { payment, status, refreshPaymentStatus } = usePayment();
    assert.equal(payment, null);
    assert.equal(status, "idle");
    assert.equal(typeof refreshPaymentStatus, "function");
    return null;
  }
  const orderSources = [];
  function StaffProbe() {
    assert.equal(useSession().isAuthenticated, false);
    orderSources.push(useOrders().orders);
    return null;
  }
  function TeamProbe() { assert.deepEqual(useTeam().members, []); return null; }
  function AdapterProbe() { assert.equal(useServices().mode, "injected"); return null; }
  renderRoute("/productos", createElement(StoreProbe));
  renderRoute("/checkout", createElement(PaymentProbe));
  renderRoute("/checkout/resultado", createElement(PaymentProbe));
  renderRoute("/staff/admin", createElement("div", null, createElement(StaffProbe), createElement(StaffProbe)));
  assert.equal(orderSources[0], orderSources[1], "Los consumidores deben compartir la misma fuente de pedidos");
  renderRoute("/staff/admin/equipo", createElement(TeamProbe));
  renderRoute("/staff/admin/despachos", createElement(TeamProbe));
  renderRoute("/staff/admin/despachos/demo-order", createElement(TeamProbe));
  assert.throws(() => renderRoute("/staff/delivery/demo-order", createElement(TeamProbe)), /TeamProvider/);
  assert.throws(() => renderRoute("/carrito", createElement(PaymentProbe)), /PaymentProvider/);
  assert.throws(() => renderRoute("/productos", createElement(StaffProbe)), /SessionProvider/);
  renderToStaticMarkup(createElement(AppProviders, { pathname: "/", adapter: { ...services, mode: "injected" } }, createElement(AdapterProbe)));

  assert.equal(services.mode, "demo");
  assert.equal(await services.auth.getSession(), null);
  const catalog = await services.catalog.list();
  assert.equal(catalog.find(({ slug }) => slug === "miel-multifloral").sizes[0].price, 6990);
  assert.equal(catalog.find(({ slug }) => slug === "miel-de-cerezo").sizes[0].price, 9000);
  assert.equal(catalog.find(({ slug }) => slug === "miel-de-avellana").sizes[0].price, 9000);
  catalog[0].name = "Cambio local";
  assert.notEqual((await services.catalog.list())[0].name, "Cambio local");
  assert.deepEqual(await services.orders.list(), []);
  await assert.rejects(services.staff.list(), /administración/);
  await services.auth.login({ email: "admin@casamiel.demo", password: "demo1234" });
  assert.equal((await services.staff.list()).length, 2);
  await services.auth.logout();
  assert.equal(await services.payments.getForOrder("demo-order"), null);
  assert.throws(() => createServices({}), /Falta el servicio/);
  const replacement = createServices({ ...services, catalog: { list: async () => [] } });
  assert.deepEqual(await replacement.catalog.list(), []);

  for (const path of ["/carrito", "/checkout", "/checkout/resultado"]) {
    assert.match(renderRoute(path, resolvePurchaseRoute(path)), /Modo demostración/);
  }
  const staffPaths = ["/staff", "/staff/admin", "/staff/admin/pedidos", "/staff/admin/ventas", "/staff/admin/despachos", "/staff/admin/equipo", "/staff/delivery"];
  for (const path of staffPaths) {
    assert.match(renderRoute(path, resolveStaffRoute(path)), /Modo demostración/);
  }
  const guarded = renderRoute("/staff/admin", resolveStaffRoute("/staff/admin"));
  assert.match(guarded, /Comprobando sesión/);
  assert.ok(!guarded.includes('href="/staff/admin/pedidos"'));
  const dashboard = renderRoute("/staff/admin", createElement(AdminDashboard));
  for (const section of ["pedidos", "ventas", "despachos", "equipo"]) {
    assert.ok(dashboard.includes(`href="/staff/admin/${section}"`));
  }
  assert.ok(!dashboard.includes("record-list"), "El panel no abre listas automáticamente");
  const sales = renderRoute("/staff/admin/ventas", createElement(SalesPage));
  for (const label of ["Hoy", "Esta semana", "Este mes", "Elegir fecha o período", "Buscar venta"]) assert.ok(sales.includes(label));
  assert.ok(!sales.includes('class="sales-results"'), "Las ventas no se despliegan sin elegir consulta");
  assert.ok(resolveStaffRoute("/staff/admin/ventas/demo-order"));
  assert.match(renderRoute("/staff/admin/ventas/demo-order", resolveStaffRoute("/staff/admin/ventas/demo-order")), /Comprobando sesión/);
  const delivery = renderRoute("/staff/delivery", createElement(DeliveryDashboard));
  assert.match(delivery, /Pendientes de entrega/);
  assert.match(delivery, /Historial de entregas/);
  assert.ok(!delivery.includes("record-list"));
  for (const path of ["/staff/admin/despachos/demo-order", "/staff/delivery/demo-order"]) {
    assert.ok(resolveStaffRoute(path));
    assert.match(renderRoute(path, resolveStaffRoute(path)), /Comprobando sesión/);
  }
  const renderAccess = (auth, pathname) => renderRoute(pathname, createElement(StaffAccess, { auth, pathname }, createElement("p", null, "Contenido protegido")));
  const baseAuth = { status: "ready", isAuthenticated: false };
  assert.match(renderAccess(baseAuth, "/staff/admin"), /Inicia sesión/);
  assert.match(renderAccess({ ...baseAuth, reason: "expired" }, "/staff/admin"), /Tu sesión venció/);
  assert.match(renderAccess({ ...baseAuth, isAuthenticated: true, session: { role: "delivery" } }, "/staff/admin/ventas"), /Acceso denegado/);
  assert.ok(!renderAccess({ ...baseAuth, isAuthenticated: true, session: { role: "delivery" } }, "/staff/admin/equipo").includes("Contenido protegido"));
  assert.match(renderAccess({ ...baseAuth, isAuthenticated: true, session: { role: "admin" } }, "/staff/admin"), /Contenido protegido/);
  assert.match(renderAccess({ ...baseAuth, isAuthenticated: true, session: { role: "delivery" } }, "/staff/delivery"), /Contenido protegido/);
  for (const path of ["/", "/productos", "/productos/miel-de-cerezo"]) {
    assert.ok(resolveStoreRoute(path));
    assert.match(renderRoute(path, resolveStoreRoute(path)), /Cargando la colmena/);
  }
  for (const resolve of [resolvePurchaseRoute, resolveStaffRoute, resolveStoreRoute]) {
    assert.equal(resolve("/ruta-inexistente"), null);
  }
  console.log("Estructura: rutas, contextos por ámbito, fuente compartida, modo demo, precios e inyección de adaptadores verificados.");
} finally {
  await server.close();
}
