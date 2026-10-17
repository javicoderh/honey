import { useState } from "react";
import { ActionButton, DetailPanel, FormField, StateMessage } from "../../shared/ui";
import { useOrders } from "./OrdersContext";

export default function OrderCommentForm({ orderId, showFeedback = true }) {
  const { updateOrder, mutation } = useOrders();
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const busy = Boolean(mutation?.busy);
  const feedback = showFeedback && mutation?.id === orderId && mutation.type === "comment" ? mutation : null;
  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim()) { setError("Escribe un comentario."); requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus()); return; }
    setError(null);
    if ((await updateOrder(orderId, "comment", { text })).ok) setText("");
  };
  return <DetailPanel title="Agregar comentario interno"><form noValidate onSubmit={submit}><FormField label="Comentario" multiline required value={text} onChange={(event) => { setText(event.target.value); if (event.target.value.trim()) setError(null); }} error={error} disabled={busy} />{feedback?.error && <StateMessage title={feedback.error} kind="error" />}{feedback?.message && <StateMessage title={feedback.message} />}<ActionButton type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar comentario"}</ActionButton></form></DetailPanel>;
}
