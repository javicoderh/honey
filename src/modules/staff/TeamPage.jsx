import { useId, useState } from "react";
import StaffShell from "./StaffShell";
import { useTeam } from "./TeamContext";
import { useSession } from "./SessionContext";
import { useOrders } from "../orders/OrdersContext";
import { canPrepareOrder } from "../orders/model.js";
import { orderDate } from "../orders/presentation.js";
import { ActionButton, ConfirmDialog, DetailPanel, FilterBar, FormField, StateMessage } from "../../shared/ui";
import { validateTeamDraft } from "./model.js";
import "../../styles/team.css";
import { useServices } from '../../services/ServicesContext';

const roleLabel = (role) => role === "admin" ? "Admin" : "Delivery";
const stateLabel = (active) => active ? "Activo" : "Inactivo";
const emptyDraft = () => ({ name: "", email: "", role: "delivery" });

function TeamMemberCard({ member, own, lastAdmin, busy, onReview }) {
  const [role, setRole] = useState(member.role);
  const id = useId();
  return <li className="team-member" data-member-id={member.id}>
    <header><div><h2>{member.name}</h2><p>{member.email}</p></div><div><strong>{roleLabel(member.role)} · {stateLabel(member.active)}</strong>{own && <span>Tu sesión</span>}</div></header>
    {lastAdmin && <StateMessage title="Último admin activo">Debe existir otro admin activo antes de desactivar esta cuenta o cambiar su rol.</StateMessage>}
    <div className="team-member__controls"><div className="form-field"><label htmlFor={id}>Rol de {member.name}</label><select id={id} value={role} onChange={(event) => setRole(event.target.value)} disabled={busy || lastAdmin}><option value="admin">Admin</option><option value="delivery">Delivery</option></select></div><ActionButton variant="secondary" disabled={busy || lastAdmin || role === member.role} onClick={() => onReview(member, { role })}>Revisar cambio de rol</ActionButton><ActionButton variant="secondary" disabled={busy || lastAdmin} onClick={() => onReview(member, { active: !member.active })}>{member.active ? "Desactivar acceso" : "Reactivar acceso"}</ActionButton></div>
    <details className="team-history"><summary>Historial de acceso</summary>{member.history?.length ? <ul>{[...member.history].reverse().map((entry, index) => <li key={`${entry.at}:${index}`}><strong>{entry.action === "staff.created" ? "Cuenta creada" : "Acceso actualizado"}</strong><p>{entry.author.name} · {orderDate(entry.at)}</p>{entry.details.changes?.map((change) => <p key={change.field}>{change.field === "role" ? "Rol" : "Estado"}: {change.field === "role" ? `${roleLabel(change.before)} → ${roleLabel(change.after)}` : `${stateLabel(change.before)} → ${stateLabel(change.after)}`}</p>)}</li>)}</ul> : <p>Cuenta inicial de demostración.</p>}</details>
  </li>;
}

export default function TeamPage() {
  const { mode } = useServices();
  const demo = mode === 'demo';
  const [password, setPassword] = useState('');
  const { members, status, refreshTeam, createMember, updateMember, mutation } = useTeam();
  const { session, views, updateView } = useSession();
  const { orders } = useOrders();
  const { query = "", filter = "all" } = views.Equipo ?? {};
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(null);
  const roleId = useId();
  const busy = Boolean(mutation?.busy);
  const adminCount = members.filter((member) => member.role === "admin" && member.active).length;
  const search = query.trim().toLocaleLowerCase("es-CL");
  const filtered = members.filter((member) => (filter === "all" || (filter === "active" ? member.active : !member.active)) && `${member.name} ${member.email}`.toLocaleLowerCase("es-CL").includes(search));
  const reviewCreate = (event) => {
    event.preventDefault();
    const found = validateTeamDraft(draft);
    if (!demo && (password.length < 12 || password.length > 128)) found.password = 'Usa una contraseña de 12 a 128 caracteres.';
    if (members.some((member) => member.email.toLowerCase() === draft.email.trim().toLowerCase())) found.email = "Ya existe una cuenta con ese correo, incluso si está inactiva.";
    setErrors(found);
    if (Object.keys(found).length) { requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus()); return; }
    setPending({ type: "create", draft: { name: draft.name.trim(), email: draft.email.trim().toLowerCase(), role: draft.role } });
  };
  const confirm = async () => {
    const result = pending.type === "create" ? await createMember({ ...pending.draft, ...(!demo ? { password } : {}) }) : await updateMember(pending.member.id, pending.changes);
    if (result.ok && pending.type === 'create') setPassword('');
    if (result.ok) { setPending(null); if (pending.type === "create") { setCreating(false); setDraft(emptyDraft()); setErrors({}); } }
  };
  const affected = pending?.member?.role === "delivery" && (pending.changes.active === false || (pending.changes.role && pending.changes.role !== "delivery")) ? orders.filter((order) => canPrepareOrder(order) && order.delivery.assignedTo === pending.member.id && order.delivery.status !== "delivered").length : 0;
  return <StaffShell title="Equipo" description={demo ? "Administra las cuentas de prueba, sus roles y sus accesos." : "Administra las cuentas del equipo, sus roles y sus accesos."} back="/staff/admin">
    <div className="commerce-actions team-toolbar"><ActionButton disabled={busy} onClick={() => { setCreating(!creating); setErrors({}); setPassword(''); }}>{creating ? "Cerrar alta" : "Crear integrante"}</ActionButton><ActionButton variant="secondary" disabled={busy || status === "loading"} onClick={refreshTeam}>Actualizar equipo</ActionButton></div>
    {mutation?.message && <StateMessage title={mutation.message} />}{mutation?.error && <StateMessage title={mutation.error} kind="error" />}
    {creating && <DetailPanel title={demo ? "Nueva cuenta de demostración" : "Nueva cuenta del equipo"}>{demo ? <p>Las cuentas usan la contraseña ficticia <strong>demo1234</strong> y se reinician al recargar. No se envían invitaciones por correo.</p> : <p>Define una contraseña única y compártela con la persona por un medio privado. No se envían invitaciones por correo.</p>}<form className="team-form" noValidate onSubmit={reviewCreate}><fieldset disabled={busy || status !== "ready"} className="team-fields"><FormField label="Nombre del integrante" value={draft.name} error={errors.name} required onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /><FormField label="Correo del integrante" type="email" value={draft.email} error={errors.email} required onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} />{!demo && <FormField label="Contraseña de la nueva cuenta" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} error={errors.password} onChange={(event) => setPassword(event.target.value)} />}<div className="form-field"><label htmlFor={roleId}>Rol del integrante</label><select id={roleId} value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))} aria-invalid={errors.role ? true : undefined} aria-describedby={errors.role ? `${roleId}-error` : undefined}><option value="delivery">Delivery</option><option value="admin">Admin</option></select>{errors.role && <small className="field-error" id={`${roleId}-error`}>{errors.role}</small>}</div><ActionButton type="submit" disabled={busy || status !== "ready"}>Revisar nueva cuenta</ActionButton></fieldset></form></DetailPanel>}
    <FilterBar label="Buscar integrante por nombre o correo" query={query} onQueryChange={(value) => updateView("Equipo", { query: value })}><div className="team-filters" role="group" aria-label="Estado de integrantes">{[["all", "Todos"], ["active", "Activos"], ["inactive", "Inactivos"]].map(([value, label]) => <ActionButton key={value} variant={filter === value ? "primary" : "secondary"} aria-pressed={filter === value} onClick={() => updateView("Equipo", { filter: value })}>{label}</ActionButton>)}</div></FilterBar>
    {status === "error" ? <StateMessage title="No pudimos consultar el equipo" kind="error">Actualiza el equipo para reintentar.</StateMessage> : status !== "ready" ? <StateMessage title="Cargando equipo…" /> : !filtered.length ? <StateMessage title="No hay integrantes para esta consulta" /> : <ul className="team-list" aria-label="Integrantes del equipo">{filtered.map((member) => <TeamMemberCard key={member.id} member={member} own={member.id === session?.id} lastAdmin={member.active && member.role === "admin" && adminCount === 1} busy={busy} onReview={(target, changes) => setPending({ type: "update", member: target, changes })} />)}</ul>}
    <ConfirmDialog open={Boolean(pending)} title={pending?.type === "create" ? "Confirmar alta" : "Confirmar cambio de acceso"} confirmLabel={pending?.type === "create" ? (demo ? "Crear cuenta de prueba" : "Crear cuenta") : "Confirmar cambio"} busy={busy} onClose={() => setPending(null)} onConfirm={confirm}>
      {pending?.type === "create" ? <><p><strong>{pending.draft.name}</strong><br />{pending.draft.email}<br />Rol: {roleLabel(pending.draft.role)} · Activo</p>{demo ? <p>Podrá ingresar con la contraseña de prueba demo1234 durante esta demostración.</p> : <p>Podrá iniciar sesión con la contraseña definida. No se mostrará en el historial.</p>}</> : pending && <><p><strong>{pending.member.name}</strong><br />{pending.member.email}</p>{pending.changes.role && <p>Rol: {roleLabel(pending.member.role)} → {roleLabel(pending.changes.role)}</p>}{Object.hasOwn(pending.changes, "active") && <p>Acceso: {stateLabel(pending.member.active)} → {stateLabel(pending.changes.active)}</p>}<p>El acceso anterior dejará de ser válido. La cuenta necesitará iniciar sesión nuevamente.</p>{pending.member.id === session?.id && <p>Estás modificando tu propia cuenta y saldrás de tu sesión actual.</p>}{affected > 0 && <p>Esta cuenta tiene {affected} entregas pendientes. Las asignaciones se conservarán; revísalas en Despachos.</p>}</>}
      {mutation?.error && <StateMessage title={mutation.error} kind="error" />}
    </ConfirmDialog>
  </StaffShell>;
}
