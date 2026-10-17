import { useEffect, useId, useRef } from "react";
import { Link } from "../components/Layout";
import { useServices } from "../services/ServicesContext";
import "../styles/commerce.css";

export function ActionButton({ children, variant = "primary", className = "", type = "button", ...props }) {
  return <button type={type} className={`commerce-button commerce-button--${variant} ${className}`} {...props}>{children}</button>;
}

export function AccessCard({ href, title, description, label = "Abrir sección" }) {
  return <Link href={href} className="access-card"><strong>{title}</strong><span>{description}</span><small>{label} ↗</small></Link>;
}

export function StateMessage({ title, children, kind = "info" }) {
  return <div className={`state-message state-message--${kind}`} role={kind === "error" ? "alert" : "status"}><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export function DemoNotice() {
  const { mode } = useServices();
  if (mode !== "demo") return null;
  return <StateMessage title="Modo demostración">Datos simulados. No se realizan cobros ni se gestionan pedidos reales. El acceso staff usa cuentas de prueba; los permisos reales se implementarán en el servidor.</StateMessage>;
}

export function FilterBar({ query, onQueryChange, label = "Buscar", children }) {
  const id = useId();
  return <div className="filter-bar"><label htmlFor={id}>{label}<input id={id} type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} /></label>{children}</div>;
}

export function RecordList({ items, renderItem, emptyTitle = "Sin registros", emptyMessage = "Los registros aparecerán aquí." }) {
  if (!items.length) return <StateMessage title={emptyTitle}>{emptyMessage}</StateMessage>;
  return <ul className="record-list">{items.map((item) => <li key={item.id}>{renderItem(item)}</li>)}</ul>;
}

export function DetailPanel({ title, items = [], children }) {
  const id = useId();
  return <section className="detail-panel" aria-labelledby={id}><h2 id={id}>{title}</h2>{items.length > 0 && <dl>{items.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>}{children}</section>;
}

export function FormField({ label, error, hint, multiline = false, required = false, ...props }) {
  const id = useId();
  const Input = multiline ? "textarea" : "input";
  const requirement = required ? "Obligatorio" : /opcional/i.test(label) ? null : "Opcional";
  const describedBy = [requirement && `${id}-requirement`, hint && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ");
  return <div className="form-field"><div className="form-field__label"><label htmlFor={id}>{label}</label>{requirement && <small className="field-requirement" id={`${id}-requirement`}>{requirement}</small>}</div><Input {...props} required={required} id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy || undefined} />{hint && <small id={`${id}-help`}>{hint}</small>}{error && <small id={`${id}-error`} className="field-error" aria-live="polite">{error}</small>}</div>;
}

export function ConfirmDialog({ open, title, children, onConfirm, onClose, confirmLabel = "Confirmar", busy = false }) {
  const dialog = useRef(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    return () => { if (element.open) element.close(); };
  }, [open]);
  return <dialog ref={dialog} className="confirm-dialog" aria-labelledby={id} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}><h2 id={id}>{title}</h2>{children}<div className="commerce-actions"><ActionButton variant="secondary" disabled={busy} onClick={onClose}>Cancelar</ActionButton><ActionButton disabled={busy} onClick={onConfirm}>{busy ? "Guardando…" : confirmLabel}</ActionButton></div></dialog>;
}
