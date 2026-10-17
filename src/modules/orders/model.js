import { actorSnapshot, money, requiredText, timestamp } from "../../shared/domain.js";
import { purchaseSnapshot } from "../purchase/model.js";
import { createPayment, currentPayment, changePaymentStatus, PAYMENT_STATUS } from "../payments/model.js";
import { createDelivery, changeDeliveryStatus, DELIVERY_STATUS } from "../deliveries/model.js";

export function snapshotItems(items, catalog) {
  if (!Array.isArray(items) || !items.length) throw new Error("El pedido requiere productos");
  return items.map(({ slug, format, quantity }) => {
    const product = catalog.find((entry) => entry.slug === slug);
    const size = product?.sizes.find((entry) => entry.label === format);
    if (!size) throw new Error("Producto o formato no disponible");
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Cantidad inválida");
    const unitPrice = money(size.price, "Precio");
    return { productSlug: product.slug, name: product.name, format: size.label, quantity, unitPrice, lineTotal: money(unitPrice * quantity) };
  });
}

function appendHistory(order, { action, author, at, details = {} }) {
  const date = timestamp(at);
  if (date < order.createdAt) throw new Error("El evento no puede preceder al pedido");
  const entry = { id: `${order.id}:event:${order.history.length + 1}`, action, author: actorSnapshot(author), at: date, details: structuredClone(details) };
  return { ...order, updatedAt: date > order.updatedAt ? date : order.updatedAt, history: [...order.history, entry] };
}

export function createOrder({ id, number, draft, items, catalog, shippingFee, createdAt }) {
  const orderId = requiredText(id, "ID del pedido");
  const snapshot = purchaseSnapshot(draft);
  const lines = snapshotItems(items, catalog);
  const subtotal = money(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const fee = money(shippingFee, "Costo de despacho");
  const total = money(subtotal + fee);
  const date = timestamp(createdAt);
  const order = {
    id: orderId, number: requiredText(number, "Número del pedido"), currency: "CLP", ...snapshot,
    items: lines, subtotal, shippingFee: fee, total,
    payments: [createPayment({ id: `${orderId}:payment:1`, orderId, amount: total, createdAt: date })],
    delivery: createDelivery({ id: `${orderId}:delivery`, orderId, createdAt: date }),
    createdAt: date, updatedAt: date, cancelledAt: null, archivedAt: null, comments: [], history: [],
  };
  return appendHistory(order, { action: "order.created", author: { id: "guest", name: snapshot.buyer.name, role: "consumer" }, at: date });
}

export function canPrepareOrder(order) {
  return !order.cancelledAt && !order.archivedAt && !order.paymentReviewRequired && currentPayment(order)?.status === PAYMENT_STATUS.APPROVED;
}

export function recordPaymentUpdate(order, { paymentId, status, transactionId, at, author }) {
  const actor = actorSnapshot(author);
  if (!["admin", "system"].includes(actor.role)) throw new Error("El registro de pagos requiere un autor de administración o sistema");
  const payment = order.payments.find((entry) => entry.id === paymentId);
  if (!payment) throw new Error("Pago no encontrado en el pedido");
  const updated = changePaymentStatus(payment, status, { transactionId, at });
  if (updated === payment) return order;
  if (updated.status === PAYMENT_STATUS.APPROVED && order.payments.some((entry) => entry.id !== paymentId && entry.approvedAt)) throw new Error("El pedido ya registra una venta aprobada");
  return appendHistory({ ...order, payments: order.payments.map((entry) => entry.id === paymentId ? updated : entry) },
    { action: "payment.status_changed", author: actor, at, details: { paymentId, from: payment.status, to: updated.status } });
}

export function recordDeliveryUpdate(order, { status, at, author, reason = "" }) {
  const actor = actorSnapshot(author);
  if (!["admin", "delivery"].includes(actor.role)) throw new Error("La entrega requiere un autor del equipo");
  if (order.cancelledAt || order.archivedAt) throw new Error("El pedido cancelado o archivado no admite cambios de entrega");
  if (status !== DELIVERY_STATUS.PENDING && !canPrepareOrder(order)) throw new Error("La entrega requiere un pago aprobado y un pedido activo");
  if (actor.role === "delivery") {
    if (order.delivery.assignedTo !== actor.id) throw new Error("La entrega no está asignada a tu sesión");
    if (!["in_transit", "delivered", "failed"].includes(status) || order.delivery.status === "pending") throw new Error("Estado no disponible para delivery");
  }
  if (status === DELIVERY_STATUS.READY && !["pending", "ready", "failed"].includes(order.delivery.status)) throw new Error("Solo se prepara un pedido pendiente o con entrega no realizada");
  if (status === DELIVERY_STATUS.IN_TRANSIT && !order.delivery.assignedTo) throw new Error("Asigna un delivery antes de iniciar el reparto");
  const delivery = changeDeliveryStatus(order.delivery, status, { at, reason });
  if (delivery === order.delivery) return order;
  const updatedDelivery = { ...delivery, deliveredBy: status === "delivered" ? actor : null };
  return appendHistory({ ...order, delivery: updatedDelivery }, { action: "delivery.status_changed", author: actor, at,
    details: { from: order.delivery.status, to: delivery.status, previousDeliveredAt: order.delivery.deliveredAt, previousDeliveredBy: order.delivery.deliveredBy ?? null, deliveredAt: delivery.deliveredAt, reason: reason.trim() } });
}

export function addOrderComment(order, { id, text, author, at }) {
  const actor = actorSnapshot(author);
  if (!["admin", "delivery"].includes(actor.role)) throw new Error("Los comentarios internos requieren un autor del equipo");
  if (actor.role === "delivery" && (order.delivery.assignedTo !== actor.id || !canPrepareOrder(order))) throw new Error("El comentario requiere una entrega activa asignada a tu sesión");
  const comment = { id: requiredText(id, "ID del comentario"), text: requiredText(text, "Comentario"), author: actor, createdAt: timestamp(at) };
  if (order.comments.some((entry) => entry.id === comment.id)) throw new Error("El comentario ya existe");
  return appendHistory({ ...order, comments: [...order.comments, comment] }, { action: "comment.added", author: actor, at, details: { commentId: comment.id } });
}

function requireAdmin(author) {
  const actor = actorSnapshot(author);
  if (actor.role !== "admin") throw new Error("Esta acción requiere administración");
  return actor;
}

export function assignOrderDelivery(order, { assignee, reason = "", author, at }) {
  const actor = requireAdmin(author);
  if (!canPrepareOrder(order)) throw new Error("La asignación requiere un pago aprobado y un pedido activo");
  if (order.delivery.status !== "ready") throw new Error("Marca el pedido como listo antes de asignarlo");
  if (!assignee?.id || assignee.role !== "delivery" || assignee.active !== true) throw new Error("Elige un delivery activo del equipo");
  if (order.delivery.assignedTo === assignee.id) return order;
  if (order.delivery.assignedTo) requiredText(reason, "Motivo de reasignación");
  const date = timestamp(at);
  if (date < order.delivery.updatedAt) throw new Error("La asignación no puede preceder al estado de entrega");
  return appendHistory({ ...order, delivery: { ...order.delivery, assignedTo: assignee.id, assignedName: assignee.name, assignedAt: date, updatedAt: date } },
    { action: "delivery.assigned", author: actor, at: date, details: { previousAssignedTo: order.delivery.assignedTo, previousAssignedName: order.delivery.assignedName ?? null, assignedTo: assignee.id, assignedName: assignee.name, reason: reason.trim() } });
}

export function updateOrderOperations(order, { changes, reason, author, at }) {
  const actor = requireAdmin(author);
  if (order.cancelledAt || order.archivedAt) throw new Error("El pedido cancelado o archivado no admite correcciones operativas");
  const allowed = { recipient: ["name", "phone"], shippingAddress: ["street", "commune", "apartment", "reference"], deliveryInstructions: null };
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) throw new Error("Corrección inválida");
  for (const [key, value] of Object.entries(changes)) {
    if (!Object.hasOwn(allowed, key)) throw new Error("Solo se pueden corregir datos operativos; productos, comprador e importes se conservan");
    if (allowed[key] && (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((field) => !allowed[key].includes(field)))) throw new Error("Campo operativo inválido");
    for (const text of allowed[key] ? Object.values(value) : [value]) if (typeof text !== "string") throw new Error("El dato operativo debe ser texto");
  }
  const snapshot = purchaseSnapshot({ ...order, recipientSameAsBuyer: false, recipient: { ...order.recipient, ...changes.recipient }, shippingAddress: { ...order.shippingAddress, ...changes.shippingAddress }, deliveryInstructions: changes.deliveryInstructions ?? order.deliveryInstructions });
  const diff = [];
  for (const key of ["recipient", "shippingAddress", "deliveryInstructions"]) {
    if (typeof snapshot[key] === "string") {
      if (snapshot[key] !== order[key]) diff.push({ field: key, before: order[key], after: snapshot[key] });
    } else for (const field of Object.keys(snapshot[key])) if (snapshot[key][field] !== order[key][field]) diff.push({ field: `${key}.${field}`, before: order[key][field], after: snapshot[key][field] });
  }
  if (!diff.length) return order;
  return appendHistory({ ...order, recipient: snapshot.recipient, shippingAddress: snapshot.shippingAddress, deliveryInstructions: snapshot.deliveryInstructions,
    originalDeliveryInstructions: order.originalDeliveryInstructions ?? order.deliveryInstructions },
  { action: "order.operations_updated", author: actor, at, details: { reason: requiredText(reason, "Motivo de corrección"), changes: diff } });
}

export function changeOrderLifecycle(order, { action, reason, author, at }) {
  const actor = requireAdmin(author);
  if (!["cancel", "archive"].includes(action)) throw new Error("Acción de pedido inválida");
  const field = action === "cancel" ? "cancelledAt" : "archivedAt";
  if (order[field]) return order;
  if (action === "cancel" && order.archivedAt) throw new Error("El pedido archivado no se puede cancelar");
  return appendHistory({ ...order, [field]: timestamp(at) }, { action: action === "cancel" ? "order.cancelled" : "order.archived", author: actor, at, details: { reason: requiredText(reason, "Motivo") } });
}
