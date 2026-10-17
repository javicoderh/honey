import { useCallback } from 'react';
import { useServices } from '../../services/ServicesContext';
import { useResource } from '../../shared/useResource';
import { ActionButton, DetailPanel, StateMessage } from '../../shared/ui';
import { usePayment } from './PaymentContext';

export default function OnlinePaymentPanel({ orderId }) {
  const services = useServices();
  const payment = usePayment();
  const load = useCallback(() => services.payments.capabilities(), [services]);
  const capability = useResource(load, null);
  if (payment.payment?.reviewRequired) return <StateMessage title="Pago en revisión">Estamos revisando el pago de este pedido. No realices otro pago; contacta al equipo.</StateMessage>;
  if (['approved', 'refunded'].includes(payment.paymentState)) return null;
  return <DetailPanel title="Pago del pedido">
    {capability.status === 'error' ? <><StateMessage kind="error" title="No pudimos consultar la disponibilidad del pago." /><ActionButton onClick={capability.refresh}>Reintentar consulta</ActionButton></> : capability.status !== 'ready' ? <StateMessage title="Consultando disponibilidad del pago…" /> : !capability.data?.enabled ? <StateMessage title="Pago en línea aún no habilitado">Tu pedido está registrado; no se ha realizado un cobro. La integración de pago estará disponible próximamente.</StateMessage> : <><p>Continúa en Mercado Pago para realizar el pago. El pedido se confirmará después de verificarlo.</p><ActionButton disabled={payment.processing || payment.status !== 'ready'} onClick={async () => { const url = await payment.startCheckout(orderId); if (url) window.location.assign(url); }}>{payment.processing ? 'Preparando pago…' : payment.paymentState === 'rejected' ? 'Reintentar con Mercado Pago' : 'Pagar con Mercado Pago'}</ActionButton></>}
    {payment.checkoutError && <StateMessage kind="error" title={payment.checkoutError} />}
    <div className="commerce-actions"><ActionButton variant="secondary" disabled={payment.status === 'loading'} onClick={() => payment.refreshPaymentStatus(orderId)}>Consultar estado del pago</ActionButton></div>
  </DetailPanel>;
}
