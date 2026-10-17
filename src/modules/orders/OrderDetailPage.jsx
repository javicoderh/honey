import { useState } from "react";
import StaffShell from "../staff/StaffShell";
import { useOrders } from "./OrdersContext";
import { ActionButton, ConfirmDialog, DetailPanel, FormField, StateMessage } from "../../shared/ui";
import { Link } from "../../components/Layout";
import { navigate } from "../../router";
import { canPrepareOrder } from "./model.js";
import { DELIVERY_LABELS } from "../deliveries/model.js";
import { validateCheckout } from "../purchase/checkout.js";
import { FIELD_LABELS } from "./presentation.js";
import OrderRecordDetails from "./OrderRecordDetails";
import "../../styles/orders.css";

const ACTION_LABELS = { operations: "Guardar corrección", delivery: "Confirmar estado de entrega", cancel: "Cancelar pedido", archive: "Archivar pedido", delete: "Eliminar registro de prueba" };

function OrderManagement({ order }) {
  const { updateOrder, mutation } = useOrders();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => ({ recipient: { ...order.recipient }, shippingAddress: { ...order.shippingAddress }, deliveryInstructions: order.deliveryInstructions }));
  const [editReason, setEditReason] = useState("");
  const [errors, setErrors] = useState({});
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState(null);
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(null);
  const busy = Boolean(mutation?.busy);
  const active = !order.cancelledAt && !order.archivedAt;
  const field = (group, key, label, props = {}) => <FormField label={label} value={draft[group][key]} error={errors[`${group}.${key}`]} onChange={(event) => setDraft((current) => ({ ...current, [group]: { ...current[group], [key]: event.target.value } }))} {...props} />;
  const ask = (type, payload = {}) => { setPending({ type, payload }); setReason(""); setReasonError(null); };
  const prepareEdit = (event) => {
    event.preventDefault();
    const found = validateCheckout({ ...draft, buyer: order.buyer, recipientSameAsBuyer: false });
    if (!editReason.trim()) found.reason = "Indica el motivo de la corrección.";
    setErrors(found);
    if (Object.keys(found).length) { requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus()); return; }
    const preview = [];
    for (const [group, value] of Object.entries(draft)) {
      if (typeof value === "string") { if (value.trim() !== order[group]) preview.push({ field: group, before: order[group], after: value.trim() }); }
      else for (const [key, text] of Object.entries(value)) if (text.trim() !== order[group][key]) preview.push({ field: `${group}.${key}`, before: order[group][key], after: text.trim() });
    }
    if (!preview.length) { setErrors({ reason: "No hay cambios para guardar." }); return; }
    setPending({ type: "operations", payload: { changes: draft, reason: editReason }, preview });
  };
  const confirm = async () => {
    const requiredReason = ["cancel", "archive"].includes(pending.type) || (pending.type === "delivery" && (pending.payload.status === "failed" || order.delivery.status === "delivered"));
    if (requiredReason && !reason.trim()) { setReasonError("Indica un motivo para continuar."); return; }
    const result = await updateOrder(order.id, pending.type, { ...pending.payload, ...(pending.type !== "operations" ? { reason } : {}) });
    if (result.ok) {
      if (pending.type === "delete") navigate({ preventDefault() {} }, "/staff/admin/pedidos");
      setPending(null); setEditing(false);
    }
  };
  const submitComment = async (event) => {
    event.preventDefault();
    if (!comment.trim()) { setCommentError("Escribe un comentario."); return; }
    if ((await updateOrder(order.id, "comment", { text: comment })).ok) { setComment(""); setCommentError(null); }
  };
  return <>
    {order.cancelledAt && <StateMessage title="Pedido cancelado">La cancelación no efectúa ni acredita un reembolso. El estado del pago se conserva.</StateMessage>}
    {order.archivedAt && <StateMessage title="Pedido archivado">Se conservan los datos, pagos e historial.</StateMessage>}
    {mutation?.id === order.id && mutation.error && <StateMessage title={mutation.error} kind="error" />}
    {mutation?.id === order.id && mutation.message && <StateMessage title={mutation.message} />}
    <DetailPanel title="Gestión del pedido"><div className="commerce-actions">
      {active && <><ActionButton disabled={busy} onClick={() => { setEditing(!editing); setErrors({}); }}> {editing ? "Cerrar corrección" : "Corregir datos de entrega"}</ActionButton>{["pending", "delivered", "failed"].map((status) => <ActionButton key={status} variant="secondary" disabled={busy || order.delivery.status === status || (status !== "pending" && !canPrepareOrder(order))} onClick={() => ask("delivery", { status })}>{status === "pending" ? "Marcar pendiente" : status === "delivered" ? "Marcar entregado" : "Entrega no realizada"}</ActionButton>)}<ActionButton variant="secondary" disabled={busy} onClick={() => ask("cancel")}>Cancelar pedido</ActionButton></>}
      {!order.archivedAt && <ActionButton variant="secondary" disabled={busy} onClick={() => ask("archive")}>Archivar pedido</ActionButton>}
      {order.isTest === true && <ActionButton variant="secondary" disabled={busy} onClick={() => ask("delete")}>Eliminar registro de prueba</ActionButton>}
    </div>{active && !canPrepareOrder(order) && <p>Para confirmar una entrega o registrar una entrega fallida se requiere un pago aprobado.</p>}</DetailPanel>
    {editing && active && <DetailPanel title="Corregir datos de entrega"><form noValidate onSubmit={prepareEdit}><fieldset className="order-fields" disabled={busy}>
      {field("recipient", "name", "Nombre del destinatario", { required: true })}{field("recipient", "phone", "Teléfono del destinatario", { type: "tel", required: true })}{field("shippingAddress", "street", "Calle y número", { required: true })}{field("shippingAddress", "commune", "Comuna", { required: true })}{field("shippingAddress", "apartment", "Departamento / casa / oficina")}{field("shippingAddress", "reference", "Referencias")}
      <FormField label="Indicaciones operativas" multiline value={draft.deliveryInstructions} onChange={(event) => setDraft((current) => ({ ...current, deliveryInstructions: event.target.value }))} hint="Las indicaciones originales del comprador se conservarán." />
      <FormField label="Motivo de corrección" value={editReason} onChange={(event) => setEditReason(event.target.value)} error={errors.reason} required />
      <ActionButton type="submit" disabled={busy}>Revisar corrección</ActionButton>
    </fieldset></form></DetailPanel>}
    <OrderRecordDetails order={order} />
    <DetailPanel title="Agregar comentario interno"><form onSubmit={submitComment}><FormField label="Comentario" multiline value={comment} onChange={(event) => setComment(event.target.value)} error={commentError} disabled={busy} /><ActionButton type="submit" disabled={busy}>Guardar comentario</ActionButton></form></DetailPanel>
    <ConfirmDialog open={Boolean(pending)} title={pending ? ACTION_LABELS[pending.type] : "Confirmar"} confirmLabel={pending ? ACTION_LABELS[pending.type] : "Confirmar"} busy={busy} onClose={() => setPending(null)} onConfirm={confirm}>
      <p>Pedido {order.number}</p>
      {pending?.type === "operations" ? <><ul className="order-change-preview">{pending.preview.map((change) => <li key={change.field}><strong>{FIELD_LABELS[change.field]}</strong>: «{change.before || "Vacío"}» → «{change.after || "Vacío"}»</li>)}</ul><p>Motivo: {pending.payload.reason}</p></> : pending?.type === "delete" ? <p>Se eliminará definitivamente este registro de prueba, incluidos sus comentarios e historial.</p> : <>
        {pending?.type === "delivery" && <p>Entrega: {DELIVERY_LABELS[order.delivery.status]} → {DELIVERY_LABELS[pending.payload.status]}. La fecha efectiva se registra al confirmar entregado; cualquier fecha anterior se conserva en el historial.</p>}
        {pending?.type === "cancel" && <p>Se cancelará el pedido conservando su historial. Esta acción no realiza un reembolso ni cambia el estado del pago.</p>}
        {pending?.type === "archive" && <p>Se ocultará de las consultas habituales. Puedes encontrarlo activando «Incluir archivados». Se conservarán los pagos y el historial.</p>}
        <FormField label={pending?.type === "delivery" && pending.payload.status !== "failed" && order.delivery.status !== "delivered" ? "Motivo (opcional)" : "Motivo"} multiline value={reason} onChange={(event) => setReason(event.target.value)} error={reasonError} disabled={busy} />
      </>}
      {mutation?.id === order.id && mutation.error && <StateMessage title={mutation.error} kind="error" />}
    </ConfirmDialog>
  </>;
}

export default function OrderDetailPage({ id }) {
  const { getOrder, status, refreshOrders } = useOrders();
  const order = getOrder(id);
  return <StaffShell title={order ? `Pedido ${order.number}` : "Detalle del pedido"} back="/staff/admin/pedidos" backLabel="Volver a pedidos">
    {status === "loading" ? <StateMessage title="Cargando pedido…" /> : status === "error" ? <><StateMessage title="No pudimos cargar el pedido" kind="error" /><ActionButton onClick={refreshOrders}>Reintentar</ActionButton></> : !order ? <StateMessage title="Pedido no encontrado">Puede que el registro de prueba se haya eliminado o que la demostración se haya reiniciado. <Link href="/staff/admin/pedidos">Volver a pedidos</Link></StateMessage> : <OrderManagement key={order.id} order={order} />}
  </StaffShell>;
}
