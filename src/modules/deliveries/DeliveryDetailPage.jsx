import StaffShell from "../staff/StaffShell";
import { useOrders } from "../orders/OrdersContext";
import { useTeam } from "../staff/TeamContext";
import { ActionButton, StateMessage } from "../../shared/ui";
import { Link } from "../../components/Layout";
import { canPrepareOrder } from "../orders/model.js";
import DeliveryActions from "./DeliveryActions";
import DeliveryInfo from "./DeliveryInfo";
import OrderCommentForm from "../orders/OrderCommentForm";
import "../../styles/deliveries.css";

function DeliveryDetail({ id, team = null }) {
  const { getOrder, status, refreshOrders, mutation } = useOrders();
  const order = getOrder(id);
  const available = order && (!team || canPrepareOrder(order));
  return <StaffShell title={available ? `${team ? "Despacho" : "Entrega"} ${order.number}` : "Detalle de entrega"} back={team ? "/staff/admin/despachos" : "/staff/delivery"} backLabel={team ? "Volver a despachos" : "Volver a mis entregas"}>
    <div className="commerce-actions delivery-refresh"><ActionButton variant="secondary" disabled={status === "loading" || mutation?.busy} onClick={refreshOrders}>Actualizar entrega</ActionButton>{team && order && <Link className="commerce-button commerce-button--secondary" href={`/staff/admin/pedidos/${encodeURIComponent(order.id)}`}>Abrir pedido relacionado</Link>}</div>
    {status === "error" ? <StateMessage title="No pudimos consultar la entrega" kind="error">Vuelve a actualizar para reintentar.</StateMessage> : status !== "ready" ? <StateMessage title="Cargando entrega…" /> : !available ? <StateMessage title="Entrega no disponible">No hay una entrega activa disponible para esta sesión. Actualiza tus entregas si hubo cambios de asignación.</StateMessage> : <>
      <DeliveryActions key={order.id} order={order} team={team} />
      <DeliveryInfo order={order} />
      <OrderCommentForm orderId={order.id} />
    </>}
  </StaffShell>;
}

export function AdminDispatchDetail({ id }) { return <DeliveryDetail id={id} team={useTeam()} />; }
export default function DeliveryDetailPage({ id }) { return <DeliveryDetail id={id} />; }
