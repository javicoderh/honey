import ServiceModulePage from "../staff/ServiceModulePage";
import StaffShell from "../staff/StaffShell";
import { ActionButton, RecordList, StateMessage } from "../../shared/ui";
import { useOrders } from "../orders/OrdersContext";
import { useSession } from "../staff/SessionContext";

export default function DeliveriesPage() {
  const { orders, status } = useOrders();
  return <ServiceModulePage title="Despachos" description="Preparación y asignación de entregas." resource={{ records: orders, status }} />;
}

export function DeliveryDashboard() {
  const { session, views, updateView } = useSession();
  const { getAssignedOrders, status, refreshOrders } = useOrders();
  const section = views.delivery?.section ?? null;
  const assigned = getAssignedOrders(session?.id);
  const pending = assigned.filter((order) => order.delivery.status !== "delivered");
  const history = assigned.filter((order) => order.delivery.status === "delivered");
  return <StaffShell title="Mis entregas" description="Elige pendientes o historial para consultar tus asignaciones."><div className="commerce-actions"><ActionButton variant={section === "pending" ? "primary" : "secondary"} aria-pressed={section === "pending"} onClick={() => updateView("delivery", { section: "pending" })}>Pendientes de entrega ({status === "ready" ? pending.length : "—"})</ActionButton><ActionButton variant={section === "history" ? "primary" : "secondary"} aria-pressed={section === "history"} onClick={() => updateView("delivery", { section: "history" })}>Historial de entregas ({status === "ready" ? history.length : "—"})</ActionButton></div>
    {section && <section className="delivery-section" aria-label={section === "pending" ? "Pendientes de entrega" : "Historial de entregas"}>{status === "error" ? <><StateMessage title="No pudimos consultar tus entregas" kind="error" /><ActionButton onClick={refreshOrders}>Reintentar</ActionButton></> : status !== "ready" ? <StateMessage title="Cargando entregas…" /> : <RecordList items={section === "pending" ? pending : history} emptyTitle={section === "pending" ? "Sin entregas pendientes" : "Sin entregas completadas"} emptyMessage="Aquí aparecerán únicamente tus entregas asignadas. Las acciones de entrega se incorporarán en la etapa 8." renderItem={(order) => <span>{order.number} · {order.recipient.name} · {order.shippingAddress.commune}</span>} />}</section>}
  </StaffShell>;
}
