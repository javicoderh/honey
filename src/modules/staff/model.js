import { actorSnapshot, requiredText, timestamp } from "../../shared/domain.js";
import { isValidEmail, textValue } from "../../shared/validation.js";

export function validateTeamDraft(draft = {}) {
  draft = draft ?? {};
  const errors = {};
  if (!textValue(draft.name)) errors.name = "Ingresa el nombre del integrante.";
  if (!textValue(draft.email)) errors.email = "Ingresa el correo del integrante.";
  else if (!isValidEmail(draft.email)) errors.email = "Ingresa un correo válido, por ejemplo nombre@dominio.cl.";
  if (!["admin", "delivery"].includes(draft.role)) errors.role = "Selecciona admin o delivery.";
  return errors;
}

function adminActor(author) {
  const actor = actorSnapshot(author);
  if (actor.role !== "admin") throw new Error("La gestión del equipo requiere administración");
  return actor;
}

export function createTeamMember(members, { id, draft, author, at }) {
  const actor = adminActor(author);
  if (Object.keys(validateTeamDraft(draft)).length) throw new Error("Revisa nombre, correo y rol del integrante");
  if (Object.keys(draft).some((key) => !["name", "email", "role"].includes(key))) throw new Error("Campo no permitido al crear una cuenta");
  const email = draft.email.trim().toLowerCase();
  if (members.some((member) => member.email.toLowerCase() === email)) throw new Error("Ya existe una cuenta con ese correo, incluso si está inactiva");
  const memberId = requiredText(id, "ID del integrante");
  if (members.some((member) => member.id === memberId)) throw new Error("El integrante ya existe");
  const date = timestamp(at);
  return { id: memberId, name: requiredText(draft.name, "Nombre"), email, role: draft.role, active: true, accessVersion: 0,
    createdAt: date, updatedAt: date, history: [{ action: "staff.created", author: actor, at: date, details: { role: draft.role } }] };
}

export function updateTeamMember(members, id, { changes, author, at }) {
  const actor = adminActor(author);
  const member = members.find((entry) => entry.id === id);
  if (!member) throw new Error("Integrante no encontrado");
  if (!changes || typeof changes !== "object" || Array.isArray(changes) || Object.keys(changes).some((key) => !["role", "active"].includes(key))) throw new Error("Solo se puede modificar el rol y el estado del acceso");
  if (Object.hasOwn(changes, "role") && !["admin", "delivery"].includes(changes.role)) throw new Error("Rol inválido");
  if (Object.hasOwn(changes, "active") && typeof changes.active !== "boolean") throw new Error("Estado de acceso inválido");
  const next = { ...member, ...changes };
  if (member.role === "admin" && member.active && (!next.active || next.role !== "admin") && !members.some((entry) => entry.id !== id && entry.role === "admin" && entry.active)) throw new Error("Debe quedar al menos un admin activo");
  const diff = ["role", "active"].filter((field) => member[field] !== next[field]).map((field) => ({ field, before: member[field], after: next[field] }));
  if (!diff.length) return member;
  const date = timestamp(at);
  if (date < member.updatedAt) throw new Error("El cambio no puede preceder al estado anterior");
  return { ...next, updatedAt: date, accessVersion: member.accessVersion + 1,
    history: [...member.history, { action: "staff.access_changed", author: actor, at: date, details: { changes: diff } }] };
}
