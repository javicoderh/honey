import StaffShell from "../staff/StaffShell";
import { ActionButton, FilterBar, StateMessage } from "../../shared/ui";
import { useOrders } from "../orders/OrdersContext";
import { useSession } from "../staff/SessionContext";
import { canPrepareOrder } from "../orders/model.js";
import DeliveryList from "./DeliveryList";
import "../../styles/deliveries.css";

export default function DeliveriesPage() {
  const { orders, status, refreshOrders } = useOrders();
  const { views, updateView } = useSession();
  const { section = "pending", query = "" } = views.Despachos ?? {};
  const groups = [["pending", "Por preparar"], ["ready", "Listos para despacho"], ["in_transit", "En reparto"], ["failed", "Entrega no realizada"], ["delivered", "Entregados"]];
  const eligible = orders.filter(canPrepareOrder);
  const search = query.trim().toLocaleLowerCase("es-CL");
  const records = eligible.filter((order) => order.delivery.status === section && [order.number, order.recipient.name, order.shippingAddress.commune].join(" ").toLocaleLowerCase("es-CL").includes(search));
  return <StaffShell title="Despachos" description="Prepara pedidos pagados y asígnalos al equipo de reparto." back="/staff/admin"><div className="commerce-actions delivery-filters" role="group" aria-label="Estado del despacho">{groups.map(([value, label]) => <ActionButton key={value} variant={section === value ? "primary" : "secondary"} aria-pressed={section === value} onClick={() => updateView("Despachos", { section: value })}>{label} ({status === "ready" ? eligible.filter((order) => order.delivery.status === value).length : "—"})</ActionButton>)}</div><FilterBar label="Buscar por pedido, destinatario o comuna" query={query} onQueryChange={(value) => updateView("Despachos", { query: value })} /><ActionButton variant="secondary" disabled={status === "loading"} onClick={refreshOrders}>Actualizar despachos</ActionButton>
    {status === "error" ? <StateMessage title="No pudimos cargar los despachos" kind="error" /> : status !== "ready" ? <StateMessage title="Cargando despachos…" /> : <DeliveryList admin orders={records} emptyTitle={query ? "Sin coincidencias" : "Sin pedidos para este estado"} />}
  </StaffShell>;
}

export function DeliveryDashboard() {
  const { session, views, updateView } = useSession();
  const { getAssignedOrders, status, refreshOrders } = useOrders();
  const section = views.delivery?.section ?? null;
  const assigned = getAssignedOrders(session?.id);
  const pending = assigned.filter((order) => order.delivery.status !== "delivered");
  const history = assigned.filter((order) => order.delivery.status === "delivered");
  return <StaffShell title="Mis entregas" description="Elige pendientes o historial para consultar tus asignaciones."><div className="commerce-actions"><ActionButton variant={section === "pending" ? "primary" : "secondary"} aria-pressed={section === "pending"} onClick={() => updateView("delivery", { section: "pending" })}>Pendientes de entrega ({status === "ready" ? pending.length : "—"})</ActionButton><ActionButton variant={section === "history" ? "primary" : "secondary"} aria-pressed={section === "history"} onClick={() => updateView("delivery", { section: "history" })}>Historial de entregas ({status === "ready" ? history.length : "—"})</ActionButton></div>
    <div className="commerce-actions"><ActionButton variant="secondary" disabled={status === "loading"} onClick={refreshOrders}>Actualizar entregas</ActionButton></div>
    {section && <section className="delivery-section" aria-label={section === "pending" ? "Pendientes de entrega" : "Historial de entregas"}>{status === "error" ? <StateMessage title="No pudimos consultar tus entregas" kind="error" /> : status !== "ready" ? <StateMessage title="Cargando entregas…" /> : <DeliveryList orders={section === "pending" ? pending : history} emptyTitle={section === "pending" ? "Sin entregas pendientes" : "Sin entregas completadas"} />}</section>}
  </StaffShell>;
}
