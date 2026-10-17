import { createContext, useCallback, useMemo, useRef, useState } from "react";
import { useServices } from "../../services/ServicesContext";
import { useResource } from "../../shared/useResource";
import { useModuleContext } from "../../shared/useModuleContext";
import { selectOrders } from "./selectors.js";
import { selectSales } from "../sales/selectors.js";
import { selectAssignedOrders } from "../deliveries/selectors.js";
import { useSession } from "../staff/SessionContext";

const OrdersContext = createContext(null);

// Pedidos, ventas y entregas consultan esta misma fuente, sin copias locales.
export function OrdersProvider({ children }) {
  const services = useServices();
  const { session, isAuthenticated } = useSession();
  const identity = isAuthenticated ? `${session.id}:${session.role}` : null;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const lock = useRef(false);
  const [mutation, setMutation] = useState(null);
  const load = useCallback(async () => ({ identity, records: await services.orders.list() }), [services, identity]);
  const { data, status, error, refresh } = useResource(load, null, Boolean(identity));
  const orders = useMemo(() => {
    if (!identity || data?.identity !== identity) return [];
    return session.role === "admin" ? selectOrders(data.records) : selectAssignedOrders(data.records, session.id);
  }, [data, identity, session?.role, session?.id]);
  const getOrder = (id) => orders.find((order) => order.id === id);
  const getSales = (filters) => session?.role === "admin" ? selectSales(orders, filters) : [];
  const getOrdersForPeriod = (period) => selectOrders(orders, { period });
  const getAssignedOrders = (deliveryId) => selectAssignedOrders(orders, deliveryId);
  const updateOrder = async (id, type, payload = {}) => {
    if (lock.current || !isAuthenticated || session.role !== "admin") return { ok: false };
    lock.current = true;
    const authorIdentity = identity;
    setMutation({ id, identity, busy: true });
    try {
      const record = await services.orders.update(id, { type, payload });
      if (currentIdentity.current !== authorIdentity) return { ok: false };
      setMutation({ id, identity, busy: false, message: type === "delete" ? "Registro de prueba eliminado." : "Cambio guardado en el historial del pedido." });
      refresh();
      return { ok: true, record };
    } catch (cause) {
      if (currentIdentity.current === authorIdentity) setMutation({ id, identity, busy: false, error: cause.message });
      return { ok: false };
    } finally { lock.current = false; }
  };
  return <OrdersContext.Provider value={{ orders, getOrder, getSales, getOrdersForPeriod, getAssignedOrders, status: identity && data?.identity !== identity ? "loading" : status, error, refreshOrders: refresh,
    updateOrder, mutation: mutation?.identity === identity ? mutation : null }}>{children}</OrdersContext.Provider>;
}

export const useOrders = () => useModuleContext(OrdersContext, "Orders");
