import StaffShell from "../staff/StaffShell";
import { ActionButton, DetailPanel, StateMessage } from "../../shared/ui";
import { useOrders } from "../orders/OrdersContext";
import OrderRecordDetails from "../orders/OrderRecordDetails";
import OrderCommentForm from "../orders/OrderCommentForm";
import { Link } from "../../components/Layout";
import { PAYMENT_LABELS } from "../payments/model.js";
import { formatPrice } from "../../data/products";
import { orderDate } from "../orders/presentation.js";
import "../../styles/orders.css";
import "../../styles/sales.css";

export default function SaleDetailPage({ id }) {
  const { status, getSales, refreshOrders } = useOrders();
  const sale = getSales().find((record) => record.id === id);
  return <StaffShell title={sale ? `Venta ${sale.order.number}` : "Detalle de venta"} back="/staff/admin/ventas" backLabel="Volver a ventas">
    {status === "loading" ? <StateMessage title="Cargando venta…" /> : status === "error" ? <><StateMessage title="No pudimos cargar la venta" kind="error" /><ActionButton onClick={refreshOrders}>Reintentar</ActionButton></> : !sale ? <StateMessage title="Venta no encontrada">Solo se muestran pedidos con pago aprobado o reembolsado. El registro de prueba también pudo eliminarse o reiniciarse.</StateMessage> : <>
      <DetailPanel title="Pago de la venta" items={[{ label: "Estado", value: PAYMENT_LABELS[sale.payment.status] }, { label: "Total pagado (CLP)", value: formatPrice(sale.totalPaid) }, { label: "Identificador de pago", value: sale.payment.id }, { label: "Transacción", value: sale.payment.providerTransactionId }, { label: "Aprobación", value: orderDate(sale.paidAt) }, ...(sale.payment.refundedAt ? [{ label: "Reembolso", value: orderDate(sale.payment.refundedAt) }] : [])]}><Link className="commerce-button commerce-button--secondary" href={`/staff/admin/pedidos/${encodeURIComponent(sale.id)}`}>Abrir pedido relacionado</Link></DetailPanel>
      {sale.order.cancelledAt && <StateMessage title="Pedido cancelado">La cancelación no cambia el estado del pago ni acredita un reembolso.</StateMessage>}
      <OrderRecordDetails order={sale.order} />
      <OrderCommentForm orderId={sale.id} />
    </>}
  </StaffShell>;
}
