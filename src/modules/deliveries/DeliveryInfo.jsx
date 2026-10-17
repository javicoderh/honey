import { DetailPanel } from "../../shared/ui";
import { DELIVERY_LABELS } from "./model.js";
import { HISTORY_LABELS, orderDate } from "../orders/presentation.js";

export function deliveryContacts(order) {
  const phone = order.recipient.phone.replace(/[^+\d]/g, "");
  const address = [order.shippingAddress.street, order.shippingAddress.commune, "Chile"].join(", ");
  return { phone: `tel:${phone}`, map: `https://maps.google.com/?q=${encodeURIComponent(address)}` };
}

export default function DeliveryInfo({ order }) {
  const contacts = deliveryContacts(order);
  const history = order.history.filter((entry) => entry.action.startsWith("delivery.") || entry.action === "comment.added");
  return <>
    <DetailPanel title="Estado de la entrega" items={[{ label: "Estado", value: DELIVERY_LABELS[order.delivery.status] }, { label: "Delivery", value: order.delivery.assignedName ?? (order.delivery.assignedTo ? "Asignado" : "Sin asignar") }, { label: "Fecha de asignación", value: orderDate(order.delivery.assignedAt) }, { label: "Entrega efectiva", value: orderDate(order.delivery.deliveredAt) }, { label: "Confirmada por", value: order.delivery.deliveredBy?.name ?? "Sin confirmar" }, ...(order.delivery.failureReason ? [{ label: "Motivo de entrega no realizada", value: order.delivery.failureReason }] : [])]} />
    <DetailPanel title="Productos para entregar"><ul className="delivery-items">{order.items.map((item, index) => <li key={index}><strong>{item.name}</strong><span>{item.format} · Cantidad: {item.quantity}</span></li>)}</ul></DetailPanel>
    <DetailPanel title="Destinatario y dirección" items={[{ label: "Persona que recibe", value: order.recipient.name }, { label: "Teléfono del destinatario", value: order.recipient.phone }, { label: "Calle y número", value: order.shippingAddress.street }, { label: "Comuna", value: order.shippingAddress.commune }, { label: "Departamento / casa / oficina", value: order.shippingAddress.apartment || "Sin indicar" }, { label: "Referencias", value: order.shippingAddress.reference || "Sin referencias" }, { label: "Indicaciones originales del comprador", value: (order.originalDeliveryInstructions ?? order.deliveryInstructions) || "Sin indicaciones" }, { label: "Indicaciones operativas actuales", value: order.deliveryInstructions || "Sin indicaciones" }]}><div className="commerce-actions"><a className="commerce-button commerce-button--secondary" href={contacts.phone}>Llamar al destinatario</a><a className="commerce-button commerce-button--secondary" href={contacts.map} target="_blank" rel="noopener noreferrer">Abrir dirección en el mapa</a></div></DetailPanel>
    <DetailPanel title="Comentarios operativos">{!order.comments.length ? <p>Sin comentarios internos.</p> : <ul className="delivery-timeline">{order.comments.map((entry) => <li key={entry.id}><p>{entry.text}</p><small>{entry.author.name} · {orderDate(entry.createdAt)}</small></li>)}</ul>}</DetailPanel>
    <DetailPanel title="Historial de entrega"><ol className="delivery-timeline">{[...history].reverse().map((entry) => <li key={entry.id}><strong>{HISTORY_LABELS[entry.action] ?? entry.action}</strong><p>{entry.author.name} · {orderDate(entry.at)}</p>{entry.details.assignedName && <p>{entry.details.previousAssignedName ? `${entry.details.previousAssignedName} → ` : ""}{entry.details.assignedName}</p>}{entry.details.from && <p>{DELIVERY_LABELS[entry.details.from]} → {DELIVERY_LABELS[entry.details.to]}</p>}{entry.details.reason && <p>Motivo: {entry.details.reason}</p>}{entry.details.previousDeliveredAt && <p>Fecha de entrega anterior conservada: {orderDate(entry.details.previousDeliveredAt)}{entry.details.previousDeliveredBy?.name && ` · ${entry.details.previousDeliveredBy.name}`}</p>}</li>)}</ol></DetailPanel>
  </>;
}
