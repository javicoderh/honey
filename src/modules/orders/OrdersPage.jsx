import { useOrders } from "./OrdersContext";
import { useSession } from "../staff/SessionContext";
import StaffShell from "../staff/StaffShell";
import { ActionButton, FilterBar, StateMessage } from "../../shared/ui";
import { Link } from "../../components/Layout";
import { selectOrders } from "./selectors.js";
import { currentPayment, PAYMENT_LABELS } from "../payments/model.js";
import { DELIVERY_LABELS } from "../deliveries/model.js";
import { formatPrice } from "../../data/products";
import { orderDate } from "./presentation.js";
import "../../styles/orders.css";

export default function OrdersPage() {
  const { orders, status, refreshOrders, mutation } = useOrders();
  const { views, updateView } = useSession();
  const { query = "", filter = "pending", includeArchived = false } = views.Pedidos ?? {};
  const records = selectOrders(orders, { query, filter, includeArchived });
  return <StaffShell title="Pedidos" description="Consulta pedidos y abre uno para gestionar su entrega." back="/staff/admin">
    <FilterBar label="Buscar por número o comprador" query={query} onQueryChange={(value) => updateView("Pedidos", { query: value })}><div className="order-filters" role="group" aria-label="Estado de pedidos">{[["pending", "Pendientes"], ["delivered", "Entregados"], ["all", "Todos"]].map(([value, label]) => <ActionButton key={value} variant={filter === value ? "primary" : "secondary"} aria-pressed={filter === value} onClick={() => updateView("Pedidos", { filter: value })}>{label}</ActionButton>)}</div></FilterBar>
    <label className="order-checkbox"><input type="checkbox" checked={includeArchived} onChange={(event) => updateView("Pedidos", { includeArchived: event.target.checked })} />Incluir archivados</label>
    <div className="commerce-actions"><ActionButton variant="secondary" disabled={status === "loading" || mutation?.busy} onClick={refreshOrders}>Actualizar pedidos</ActionButton></div>
    {mutation?.message && <StateMessage title={mutation.message} />}
    {status === "loading" ? <StateMessage title="Cargando pedidos…" /> : status === "error" ? <><StateMessage title="No pudimos cargar los pedidos" kind="error" /><ActionButton onClick={refreshOrders}>Reintentar</ActionButton></> : !records.length ? <StateMessage title={query ? "Sin coincidencias" : "No hay pedidos para este filtro"}>Puedes cambiar el filtro o crear una compra de demostración desde la tienda.</StateMessage> : <ul className="order-list" aria-label="Pedidos encontrados">{records.map((order) => <li key={order.id}><Link className="order-list__entry" href={`/staff/admin/pedidos/${encodeURIComponent(order.id)}`}><div><strong>{order.number}</strong><span>{orderDate(order.createdAt)}</span></div><div><strong>{order.buyer.name}</strong><span>{order.buyer.email}</span></div><div><strong>{formatPrice(order.total)}</strong><span>Pago: {PAYMENT_LABELS[currentPayment(order)?.status] ?? "Sin pago"}</span><span>Entrega: {DELIVERY_LABELS[order.delivery.status]}</span>{order.cancelledAt && <span className="order-flag">Cancelado</span>}{order.archivedAt && <span className="order-flag">Archivado</span>}</div><span aria-hidden="true">Ver detalle ↗</span></Link></li>)}</ul>}
  </StaffShell>;
}
