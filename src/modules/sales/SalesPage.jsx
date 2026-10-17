import { useId, useState } from "react";
import StaffShell from "../staff/StaffShell";
import { ActionButton, DetailPanel, FormField, StateMessage } from "../../shared/ui";
import { useOrders } from "../orders/OrdersContext";
import { useSession } from "../staff/SessionContext";
import { businessDate, createPeriod } from "../../shared/businessDates.js";
import { resolveSalesPeriod, summarizeSales } from "./model.js";
import { formatPrice } from "../../data/products";
import { orderDate } from "../orders/presentation.js";
import { PAYMENT_LABELS } from "../payments/model.js";
import { DELIVERY_LABELS } from "../deliveries/model.js";
import { Link } from "../../components/Layout";
import "../../styles/sales.css";

const QUICK = [["day", "Hoy"], ["week", "Esta semana"], ["month", "Este mes"]];
const calendarLabel = (date) => date.split("-").reverse().join("-");

export default function SalesPage() {
  const { status, getSales, refreshOrders, mutation } = useOrders();
  const { views, updateView } = useSession();
  const today = businessDate();
  const { mode = null, type = "day", date = today, month = today.slice(0, 7), endDate = today, query = "", applied = null } = views.Ventas ?? {};
  const [errors, setErrors] = useState({});
  const selectId = useId();
  const update = (changes) => updateView("Ventas", changes);
  const quick = (value) => { update({ mode: value, applied: { period: createPeriod({ type: value }), query: "" } }); setErrors({}); };
  const choose = (value) => { update({ mode: value, applied: null }); setErrors({}); };
  const submit = (event) => {
    event.preventDefault();
    let period;
    const found = {};
    if (mode === "search" && !query.trim()) found.query = "Escribe un número de pedido, identificador de pago o datos del comprador.";
    if (mode === "custom") {
      try { period = resolveSalesPeriod({ type, date, month, endDate }); }
      catch (cause) { found.period = cause.message; }
    }
    setErrors(found);
    if (Object.keys(found).length) { requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus()); return; }
    update({ applied: { period, query: query.trim() } });
  };
  const sales = applied && status === "ready" ? getSales(applied) : [];
  const summary = summarizeSales(sales);
  const period = applied?.period;
  const scope = period ? `${calendarLabel(period.startDate)} al ${calendarLabel(period.endDate)}` : "Todo el historial";
  return <StaffShell title="Ventas / Facturación" description="Registro interno de ventas y pagos. No emite boletas ni facturas tributarias." back="/staff/admin">
    <div className="sales-choices" role="group" aria-label="Elegir consulta de ventas">{QUICK.map(([value, label]) => <ActionButton key={value} variant={mode === value ? "primary" : "secondary"} aria-pressed={mode === value} onClick={() => quick(value)}>{label}</ActionButton>)}<ActionButton variant={mode === "custom" ? "primary" : "secondary"} aria-pressed={mode === "custom"} onClick={() => choose("custom")}>Elegir fecha o período</ActionButton><ActionButton variant={mode === "search" ? "primary" : "secondary"} aria-pressed={mode === "search"} onClick={() => choose("search")}>Buscar venta</ActionButton></div>
    {!mode && <StateMessage title="Elige una consulta para comenzar">Puedes consultar fechas anteriores o buscar una venta por pedido, pago o comprador.</StateMessage>}
    {["custom", "search"].includes(mode) && <DetailPanel title={mode === "custom" ? "Elegir período" : "Buscar una venta"}><form className="sales-query-form" noValidate onSubmit={submit}>
      {mode === "custom" && <><div className="form-field"><label htmlFor={selectId}>Tipo de período</label><select id={selectId} value={type} onChange={(event) => { update({ type: event.target.value }); setErrors({}); }}><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option><option value="range">Rango de fechas</option></select></div><div className="sales-date-fields">{type === "month" ? <FormField label="Mes de la venta" type="month" value={month} error={errors.period} onChange={(event) => update({ month: event.target.value })} required /> : <FormField label={type === "week" ? "Elige un día de la semana" : type === "range" ? "Fecha inicial" : "Fecha de la venta"} type="date" value={date} error={errors.period} onChange={(event) => update({ date: event.target.value })} hint={type === "week" ? "La semana comienza el lunes y termina el domingo." : undefined} required />}{type === "range" && <FormField label="Fecha final" type="date" value={endDate} onChange={(event) => update({ endDate: event.target.value })} required />}</div></>}
      <FormField label={mode === "search" ? "Número de pedido, pago o comprador" : "Filtrar por pedido, pago o comprador (opcional)"} type="search" value={query} error={errors.query} onChange={(event) => update({ query: event.target.value })} hint={mode === "search" ? "Busca en todo el historial de ventas, incluidas las reembolsadas." : undefined} required={mode === "search"} />
      <ActionButton type="submit">Consultar ventas</ActionButton>
    </form></DetailPanel>}
    {status === "error" && <StateMessage title="No pudimos consultar los pagos de los pedidos" kind="error" />}
    <div className="commerce-actions sales-refresh"><ActionButton variant="secondary" disabled={status === "loading" || mutation?.busy} onClick={refreshOrders}>{status === "loading" ? "Actualizando…" : "Actualizar ventas"}</ActionButton></div>
    {applied && <section className="sales-results" aria-labelledby="sales-results-title"><h2 id="sales-results-title">Resultados de la consulta</h2><p>{scope} · Hora de Chile{applied.query && ` · Búsqueda: «${applied.query}»`}</p>
      {status === "loading" ? <StateMessage title="Consultando ventas…" /> : status === "error" ? <StateMessage title="Los resultados no están disponibles; vuelve a consultar." /> : <>
        <div className="sales-totals"><DetailPanel title="Ventas aprobadas vigentes"><strong data-sales-approved-total>{formatPrice(summary.approvedTotal)}</strong><p>{summary.approvedCount} pagos aprobados</p></DetailPanel><DetailPanel title="Pagos reembolsados"><strong data-sales-refunded-total>{formatPrice(summary.refundedTotal)}</strong><p>{summary.refundedCount} pagos reembolsados</p></DetailPanel></div>
        <p className="sales-period-note">La consulta usa la fecha de aprobación del pago. Los reembolsos corresponden a esas ventas; la devolución puede haber ocurrido en otra fecha.</p>
        {!sales.length ? <StateMessage title="No hay ventas para esta consulta">Los pagos pendientes y rechazados no se contabilizan como ventas.</StateMessage> : <ul className="sales-list" aria-label="Ventas encontradas">{sales.map((sale) => <li key={sale.id}><Link className="sales-list__entry" href={`/staff/admin/ventas/${encodeURIComponent(sale.id)}`}><div><strong>{sale.order.number}</strong><span>Aprobación: {orderDate(sale.paidAt)}</span><span>{sale.order.buyer.name}</span></div><div><strong>{formatPrice(sale.totalPaid)}</strong><span className={sale.payment.status === "refunded" ? "sales-refunded" : ""}>{PAYMENT_LABELS[sale.payment.status]}</span><span>Entrega: {DELIVERY_LABELS[sale.order.delivery.status]}</span>{sale.order.cancelledAt && <span>Pedido cancelado · pago conservado</span>}{sale.order.archivedAt && <span>Pedido archivado</span>}</div><span>Ver venta ↗</span></Link></li>)}</ul>}
      </>}
    </section>}
  </StaffShell>;
}
