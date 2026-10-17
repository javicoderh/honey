import StaffShell from "../staff/StaffShell";
import { StateMessage } from "../../shared/ui";
import { useOrders } from "../orders/OrdersContext";

export default function SalesPage() {
  const { status } = useOrders();
  if (status === "error") return <StaffShell title="Ventas / Facturación" back="/staff/admin"><StateMessage title="No se pudieron consultar los pedidos relacionados" kind="error" /></StaffShell>;
  return <StaffShell title="Ventas / Facturación" description="Registro interno de ventas y pagos." back="/staff/admin"><StateMessage title="Consultas de ventas">Aquí podrás elegir un día, semana o mes, o buscar una venta. Las consultas se incorporarán en la etapa de Ventas.</StateMessage></StaffShell>;
}
