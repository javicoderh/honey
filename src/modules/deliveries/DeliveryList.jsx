import { Link } from "../../components/Layout";
import { RecordList } from "../../shared/ui";
import { DELIVERY_LABELS } from "./model.js";

export default function DeliveryList({ orders, admin = false, emptyTitle }) {
  return <div className="delivery-records"><RecordList items={orders} emptyTitle={emptyTitle} emptyMessage="No hay entregas para esta selección." renderItem={(order) => <Link className="delivery-record" href={`${admin ? "/staff/admin/despachos" : "/staff/delivery"}/${encodeURIComponent(order.id)}`}><div><strong>{order.number}</strong><span>{order.recipient.name}</span><span>{order.shippingAddress.street} · {order.shippingAddress.commune}</span></div><div><strong>{DELIVERY_LABELS[order.delivery.status]}</strong><span>{order.delivery.assignedName ?? (order.delivery.assignedTo ? "Delivery asignado" : "Sin asignar")}</span><span>Ver entrega ↗</span></div></Link>} /></div>;
}
