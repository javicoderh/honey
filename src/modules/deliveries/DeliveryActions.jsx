import { useId, useState } from "react";
import { ActionButton, ConfirmDialog, DetailPanel, FormField, StateMessage } from "../../shared/ui";
import { useOrders } from "../orders/OrdersContext";
import { DELIVERY_LABELS } from "./model.js";

export default function DeliveryActions({ order, team = null }) {
  const { updateOrder, mutation } = useOrders();
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [assignee, setAssignee] = useState("");
  const selectId = useId();
  const busy = Boolean(mutation?.busy);
  const ownFeedback = mutation?.id === order.id && mutation.type !== "comment" ? mutation : null;
  const ask = (type, payload) => { setPending({ type, payload }); setReason(""); setError(null); };
  const activeMembers = team?.members.filter((member) => member.role === "delivery" && member.active) ?? [];
  const selected = activeMembers.find((member) => member.id === assignee);
  const needsReason = pending?.type === "assign" ? Boolean(order.delivery.assignedTo) : pending?.payload.status === "failed" || order.delivery.status === "delivered";
  const confirm = async () => {
    if (needsReason && !reason.trim()) { setError("Indica un motivo para continuar."); requestAnimationFrame(() => document.querySelector('dialog[open] [aria-invalid="true"]')?.focus()); return; }
    if ((await updateOrder(order.id, pending.type, { ...pending.payload, reason })).ok) setPending(null);
  };
  return <DetailPanel title={team ? "Preparación y asignación" : "Gestionar mi entrega"}>
    {ownFeedback?.error && <StateMessage title={ownFeedback.error} kind="error" />}{ownFeedback?.message && <StateMessage title={ownFeedback.message} />}
    {team ? <>
      {["pending", "failed"].includes(order.delivery.status) && <ActionButton disabled={busy} onClick={() => ask("delivery", { status: "ready" })}>Marcar listo para despacho</ActionButton>}
      {order.delivery.status === "ready" && <form onSubmit={(event) => { event.preventDefault(); if (selected) ask("assign", { deliveryId: selected.id }); }}><div className="form-field"><label htmlFor={selectId}>Delivery activo</label><select id={selectId} value={assignee} onChange={(event) => setAssignee(event.target.value)} disabled={busy || team.status !== "ready"}><option value="">Seleccionar delivery</option>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div><ActionButton type="submit" disabled={busy || !selected || selected.id === order.delivery.assignedTo}>Revisar asignación</ActionButton></form>}
      {team.status === "loading" && <StateMessage title="Cargando equipo…" />}{team.status === "error" && <><StateMessage title="No pudimos consultar el equipo" kind="error" /><ActionButton onClick={team.refreshTeam}>Reintentar equipo</ActionButton></>}{team.status === "ready" && !activeMembers.length && <StateMessage title="No hay delivery activos para asignar" />}
      {!["pending", "ready", "failed"].includes(order.delivery.status) && <p>La entrega ya está en curso o finalizada. Puedes revisar su historial y gestionar correcciones desde Pedidos.</p>}
    </> : <div className="commerce-actions">{[["in_transit", "Marcar en reparto"], ["delivered", "Marcar entregado"], ["failed", "Entrega no realizada"]].map(([status, label]) => <ActionButton key={status} variant={status === "delivered" ? "primary" : "secondary"} disabled={busy || order.delivery.status === status || order.delivery.status === "pending"} onClick={() => ask("delivery", { status })}>{label}</ActionButton>)}</div>}
    <ConfirmDialog open={Boolean(pending)} title={pending?.type === "assign" ? "Confirmar asignación" : "Confirmar estado de entrega"} confirmLabel="Confirmar cambio" busy={busy} onClose={() => setPending(null)} onConfirm={confirm}>
      <p>Pedido {order.number}</p>{pending?.type === "assign" ? <p>Asignar a: {activeMembers.find((member) => member.id === pending.payload.deliveryId)?.name ?? "Delivery seleccionado"}. {order.delivery.assignedName && `Asignación anterior: ${order.delivery.assignedName}.`}</p> : <p>{DELIVERY_LABELS[order.delivery.status]} → {DELIVERY_LABELS[pending?.payload.status]}</p>}
      <p>Se registrarán tu nombre y la fecha del cambio. Las correcciones conservarán cualquier fecha de entrega anterior en el historial.</p>
      <FormField label={needsReason ? "Motivo" : "Motivo (opcional)"} required={needsReason} multiline value={reason} error={error} onChange={(event) => { setReason(event.target.value); if (event.target.value.trim()) setError(null); }} disabled={busy} />
      {ownFeedback?.error && <StateMessage title={ownFeedback.error} kind="error" />}
    </ConfirmDialog>
  </DetailPanel>;
}
