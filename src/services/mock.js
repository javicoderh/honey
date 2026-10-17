import { products } from "../data/products.js";
import { createPayment, currentPayment } from "../modules/payments/model.js";
import { createOrder, recordPaymentUpdate, recordDeliveryUpdate, addOrderComment, updateOrderOperations, changeOrderLifecycle, assignOrderDelivery, canPrepareOrder } from "../modules/orders/model.js";
import { deliveryView, selectAssignedOrders } from "../modules/deliveries/selectors.js";
import { sanitizeCart } from "../modules/cart/model.js";
import { DEMO_SHIPPING_FEE, validateCheckout } from "../modules/purchase/checkout.js";
import { createDemoAuth } from "./demoAuth.js";

// Se recrea el adaptador al iniciar la app. No contiene usuarios ni pagos reales.
export function createMockAdapter({ initialOrders = [] } = {}) {
  const staffStore = createDemoAuth();
  const { listMembers, createMember, updateMember } = staffStore;
  const auth = { getSession: staffStore.getSession, login: staffStore.login, logout: staffStore.logout, get demoAccounts() { return staffStore.demoAccounts; } };
  const orders = structuredClone(initialOrders);
  const requests = new Map();
  let nextNumber = Math.max(orders.length, ...orders.map((order) => Number(order.number.match(/^DEMO-(\d+)$/)?.[1] ?? 0)));
  const mutateOrder = async (id, command) => {
    const author = await auth.getSession();
    const isDelivery = author?.role === "delivery";
    if (author?.role !== "admin" && !(isDelivery && ["delivery", "comment"].includes(command.type))) throw new Error("Esta acción requiere una sesión de administración activa");
    const index = orders.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error(isDelivery ? "Entrega no disponible para tu sesión" : "Pedido no encontrado");
    const order = orders[index];
    if (isDelivery && (order.delivery.assignedTo !== author.id || !canPrepareOrder(order))) throw new Error("Entrega no disponible para tu sesión");
    const at = new Date().toISOString();
    const args = { ...command.payload, author, at };
    let updated;
    switch (command.type) {
      case "operations": updated = updateOrderOperations(order, args); break;
      case "comment": updated = addOrderComment(order, { ...args, id: crypto.randomUUID() }); break;
      case "delivery":
        updated = recordDeliveryUpdate(order, args); break;
      case "assign": {
        const assignee = (await listMembers()).find((member) => member.id === args.deliveryId);
        updated = assignOrderDelivery(order, { ...args, assignee }); break;
      }
      case "cancel": case "archive": updated = changeOrderLifecycle(order, { ...args, action: command.type }); break;
      case "delete":
        if (order.isTest !== true) throw new Error("Solo se pueden eliminar registros de prueba");
        orders.splice(index, 1);
        return null;
      default: throw new Error("Acción de pedido inválida");
    }
    orders[index] = updated;
    return isDelivery ? deliveryView(updated) : structuredClone(updated);
  };
  return {
    mode: "demo",
    catalog: { list: async () => structuredClone(products) },
    auth,
    orders: {
      create: async ({ requestId, draft, items }) => {
        if (!requestId) throw new Error("Falta la referencia de compra");
        if (requests.has(requestId)) {
          const existing = orders.find((entry) => entry.id === requests.get(requestId));
          if (!existing) throw new Error("El pedido de prueba asociado fue eliminado. Inicia una nueva compra.");
          return structuredClone(existing);
        }
        if (Object.keys(validateCheckout(draft)).length) throw new Error("Revisa los datos de compra");
        const id = `demo-${crypto.randomUUID()}`;
        const order = { ...createOrder({ id, number: `DEMO-${++nextNumber}`, draft, items: sanitizeCart(items), catalog: products, shippingFee: DEMO_SHIPPING_FEE, createdAt: new Date().toISOString() }), isTest: true };
        orders.push(order);
        requests.set(requestId, id);
        return structuredClone(order);
      },
      list: async () => {
        if ((await auth.getSession())?.role === "delivery") throw new Error("El listado general requiere administración");
        return structuredClone(orders);
      },
      listAssigned: async () => {
        const session = await auth.getSession();
        if (session?.role !== "delivery") throw new Error("Se requiere una sesión delivery activa");
        return selectAssignedOrders(orders, session.id).map(deliveryView);
      },
      getById: async (id) => {
        if ((await auth.getSession())?.role === "delivery") throw new Error("El detalle general requiere administración");
        return structuredClone(orders.find((order) => order.id === id) ?? null);
      },
      update: mutateOrder,
    },
    payments: {
      simulate: async (orderId, outcome) => {
        if ((await auth.getSession())?.role === "delivery") throw new Error("La simulación de pagos no está disponible para delivery");
        if (!["approved", "pending", "rejected", "connection_error"].includes(outcome)) throw new Error("Resultado de simulación inválido");
        if (outcome === "connection_error") throw new Error("No pudimos conectar con el simulador. Puedes reintentar sobre el mismo pedido.");
        const index = orders.findIndex((entry) => entry.id === orderId);
        if (index < 0) throw new Error("Pedido de demostración no encontrado");
        let order = orders[index];
        let payment = currentPayment(order);
        if (["approved", "refunded"].includes(payment.status)) return structuredClone(order);
        const at = new Date().toISOString();
        if (payment.status === "rejected") {
          payment = createPayment({ id: `${order.id}:payment:${order.payments.length + 1}`, orderId, amount: order.total, createdAt: at });
          order = { ...order, payments: [...order.payments, payment] };
        }
        orders[index] = recordPaymentUpdate(order, { paymentId: payment.id, status: outcome, transactionId: `simulated:${payment.id}`, at, author: { id: "demo", name: "Simulador de pago", role: "system" } });
        return structuredClone(orders[index]);
      },
      getForOrder: async (orderId) => {
      if ((await auth.getSession())?.role === "delivery") throw new Error("La consulta de pagos no está disponible para delivery");
      const order = orders.find((entry) => entry.id === orderId);
      return structuredClone(order ? currentPayment(order) : null);
    } },
    staff: { list: listMembers, create: createMember, update: updateMember },
  };
}
