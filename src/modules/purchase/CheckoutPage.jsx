import { useEffect, useState } from "react";
import { Link } from "../../components/Layout";
import { navigate } from "../../router";
import { formatPrice } from "../../data/products";
import { ActionButton, DemoNotice, DetailPanel, FormField, StateMessage } from "../../shared/ui";
import { useCart } from "../cart/CartContext";
import { usePurchase } from "./PurchaseContext";
import { usePayment } from "../payments/PaymentContext";
import { DEMO_SHIPPING_FEE, validateCheckout } from "./checkout.js";
import "../../styles/cart.css";
import "../../styles/checkout.css";

function Summary({ items, subtotal, shippingFee, total }) {
  return <aside className="cart-summary" aria-label="Resumen de compra"><h2>Tu compra</h2><ul className="checkout-products">{items.map((item) => <li key={`${item.productSlug ?? item.slug}:${item.format}`}><span>{item.name} · {item.format} × {item.quantity}<small>{formatPrice(item.unitPrice)} por unidad</small></span><strong>{formatPrice(item.lineTotal)}</strong></li>)}</ul><dl><div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div><div><dt>Despacho simulado</dt><dd>{formatPrice(shippingFee)}</dd></div><div className="cart-summary__total"><dt>Total CLP</dt><dd>{formatPrice(total)}</dd></div></dl><p>No se realizará ningún cobro real.</p></aside>;
}

export default function CheckoutPage() {
  const cart = useCart();
  const purchase = usePurchase();
  const { draft, updateDraft } = purchase;
  const [errors, setErrors] = useState({});
  const field = (group, key, label, props = {}) => <FormField label={label} name={`${group}.${key}`} value={draft[group][key]} error={errors[`${group}.${key}`]} onChange={(event) => updateDraft({ [group]: { [key]: event.target.value } })} {...props} />;
  const submit = async (event) => {
    event.preventDefault();
    const found = validateCheckout(draft);
    setErrors(found);
    if (Object.keys(found).length) { requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus()); return; }
    if (!cart.canCheckout || !cart.ready) return;
    if (await purchase.beginPurchase(cart.lines)) navigate({ preventDefault() {} }, "/checkout/resultado");
  };
  return <section className="container commerce-page"><DemoNotice /><header className="commerce-heading"><p className="eyebrow">Compra como invitado</p><h1>De la colmena a tu puerta.</h1><p>No necesitas crear una cuenta.</p></header>
    {purchase.order ? <DetailPanel title={`Ya creaste el pedido ${purchase.order.number}`}><Link className="commerce-button" href="/checkout/resultado">Ver pedido y continuar pago</Link></DetailPanel> : cart.status !== "ready" ? <StateMessage title={cart.status === "error" ? "No pudimos consultar el catálogo. Recarga para reintentar." : "Cargando productos…"} /> : !cart.canCheckout ? <StateMessage title="Revisa tu carrito antes de continuar"><Link href="/carrito">Volver al carrito</Link></StateMessage> : <div className="cart-layout">
      <form noValidate onSubmit={submit} aria-label="Datos de compra"><fieldset disabled={purchase.busy} className="checkout-fields"><legend>Tus datos</legend>
        {field("buyer", "name", "Nombre completo", { autoComplete: "billing name", required: true })}
        {field("buyer", "email", "Correo electrónico", { type: "email", autoComplete: "billing email", required: true })}
        {field("buyer", "phone", "Teléfono", { type: "tel", autoComplete: "billing tel", required: true })}
        <label className="checkout-checkbox"><input type="checkbox" checked={draft.recipientSameAsBuyer} onChange={(event) => updateDraft({ recipientSameAsBuyer: event.target.checked })} />Yo recibiré el pedido</label>
        {!draft.recipientSameAsBuyer && <><h2>Persona que recibe</h2>{field("recipient", "name", "Nombre del destinatario", { autoComplete: "shipping name", required: true })}{field("recipient", "phone", "Teléfono del destinatario", { type: "tel", autoComplete: "shipping tel", required: true })}</>}
        <h2>Dirección de entrega</h2><StateMessage title="Despacho de demostración: $3.000 CLP">Para esta prueba puedes ingresar cualquier comuna. La cobertura real y su tarifa se definirán antes de activar las ventas.</StateMessage>
        {field("shippingAddress", "street", "Calle y número", { autoComplete: "shipping address-line1", required: true })}
        {field("shippingAddress", "commune", "Comuna", { autoComplete: "shipping address-level2", required: true })}
        {field("shippingAddress", "apartment", "Departamento, casa u oficina (opcional)", { autoComplete: "shipping address-line2" })}
        {field("shippingAddress", "reference", "Referencias para llegar (opcional)")}
        <FormField label="Indicaciones de entrega (opcional)" multiline value={draft.deliveryInstructions} onChange={(event) => updateDraft({ deliveryInstructions: event.target.value })} hint="Por ejemplo: dejar con conserjería o entregar solo al destinatario." />
        {purchase.error && <StateMessage kind="error" title={purchase.error} />}
        <div className="commerce-actions"><ActionButton type="submit" disabled={purchase.busy}>{purchase.busy ? "Creando pedido…" : "Continuar al pago simulado"}</ActionButton><Link href="/carrito">Volver al carrito</Link></div>
      </fieldset></form><Summary items={cart.items} subtotal={cart.subtotal} shippingFee={DEMO_SHIPPING_FEE} total={cart.subtotal + DEMO_SHIPPING_FEE} />
    </div>}
  </section>;
}

export function PurchaseResultPage() {
  const purchase = usePurchase();
  const payment = usePayment();
  const order = purchase.order;
  const [outcome, setOutcome] = useState("approved");
  useEffect(() => { if (order) payment.refreshPaymentStatus(order.id); }, [order?.id]);
  useEffect(() => { if (payment.paymentState === "approved" && order) purchase.completePurchase(order.id); }, [payment.paymentState, order?.id]);
  const titles = { approved: "Pago simulado aprobado", pending: "Pago pendiente de confirmación", rejected: "Pago simulado rechazado", refunded: "Pago simulado reembolsado" };
  return <section className="container commerce-page"><DemoNotice /><header className="commerce-heading"><h1>Estado de tu compra</h1></header>
    {!order ? <StateMessage title="No hay un pedido para consultar">Los pedidos de demostración se mantienen solo mientras la aplicación está abierta; al recargar se reinician. <Link href="/checkout">Ir al checkout</Link></StateMessage> : <>
      <p className="eyebrow">Pedido {order.number}</p>
      {payment.simulationError ? <StateMessage kind="error" title="Error de conexión con el simulador">{payment.simulationError}</StateMessage> : payment.status === "error" ? <StateMessage kind="error" title="No pudimos verificar el pago"><ActionButton onClick={() => payment.refreshPaymentStatus(order.id)}>Volver a consultar</ActionButton></StateMessage> : <StateMessage title={payment.status !== "ready" ? "Verificando pago…" : titles[payment.paymentState] ?? "Sin información de pago"}>{payment.paymentState === "approved" ? "Tu compra de prueba quedó registrada. No se ha cobrado dinero ni se realizará un despacho real." : "Un pago pendiente o rechazado no habilita el despacho."}</StateMessage>}
      <div className="cart-layout"><div>
        {!["approved", "refunded"].includes(payment.paymentState) && <DetailPanel title="Simulador de pago"><p>Este paso representa el paso a Mercado Pago. Elige un resultado de prueba; no se envían datos a Mercado Pago.</p><label className="checkout-select">Resultado de prueba<select value={outcome} onChange={(event) => setOutcome(event.target.value)} disabled={payment.processing}><option value="approved">Aprobado</option><option value="pending">Pendiente</option><option value="rejected">Rechazado</option><option value="connection_error">Error de conexión</option></select></label><ActionButton disabled={payment.processing || payment.status !== "ready"} onClick={() => payment.simulatePayment(order.id, outcome)}>{payment.processing ? "Procesando…" : payment.paymentState === "rejected" || payment.simulationError ? "Reintentar pago simulado" : "Simular pago"}</ActionButton></DetailPanel>}
        <DetailPanel title="Datos de entrega" items={[{ label: "Comprador", value: `${order.buyer.name} · ${order.buyer.email}` }, { label: "Recibe", value: `${order.recipient.name} · ${order.recipient.phone}` }, { label: "Dirección", value: `${order.shippingAddress.street}, ${order.shippingAddress.apartment || ""} ${order.shippingAddress.commune}` }, { label: "Referencia", value: order.shippingAddress.reference || "Sin referencia" }, { label: "Indicaciones", value: order.deliveryInstructions || "Sin indicaciones" }]} />
        <p>Esta demostración guarda los pedidos en memoria. Al recargar la página se reinician.</p><Link className="text-link" href="/productos">Volver a los productos</Link>
        {payment.paymentState === "approved" && <div className="commerce-actions"><ActionButton variant="secondary" onClick={() => { purchase.startNewPurchase(); payment.resetPayment(); }}>Preparar otra compra</ActionButton></div>}
      </div><Summary {...order} /></div>
    </>}
  </section>;
}
