import { createContext, useCallback, useRef, useState } from "react";
import { useServices } from "../../services/ServicesContext";
import { useResource } from "../../shared/useResource";
import { useModuleContext } from "../../shared/useModuleContext";

const PaymentContext = createContext(null);

// Consulta al servicio; nunca convierte una URL de regreso en un pago aprobado.
export function PaymentProvider({ children }) {
  const services = useServices();
  const [orderId, setOrderId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [simulationError, setSimulationError] = useState(null);
  const lock = useRef(false);
  const load = useCallback(() => services.payments.getForOrder(orderId), [services, orderId]);
  const resource = useResource(load, null, Boolean(orderId));
  const payment = resource.status === "ready" && resource.data?.orderId === orderId ? resource.data : null;
  const refreshPaymentStatus = (id = orderId) => { setOrderId(id); resource.refresh(); };
  const resetPayment = () => setOrderId(null);
  const simulatePayment = async (id, outcome) => {
    if (lock.current || services.mode !== "demo") return null;
    lock.current = true; setProcessing(true); setSimulationError(null);
    try {
      const order = await services.payments.simulate(id, outcome);
      refreshPaymentStatus(id);
      return order;
    } catch (cause) { setSimulationError(cause.message); return null; }
    finally { lock.current = false; setProcessing(false); }
  };
  return <PaymentContext.Provider value={{ orderId, payment, paymentState: payment?.status ?? null, status: resource.status, error: resource.error, refreshPaymentStatus, resetPayment, simulatePayment, processing, simulationError }}>{children}</PaymentContext.Provider>;
}

export const usePayment = () => useModuleContext(PaymentContext, "Payment");
