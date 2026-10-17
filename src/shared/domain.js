export function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} es obligatorio`);
  return value.trim();
}

export function money(value, label = "Monto") {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} debe ser un entero no negativo en CLP`);
  return value;
}

export function timestamp(value) {
  if (value == null || value === "") throw new Error("Fecha obligatoria");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Fecha inválida");
  return date.toISOString();
}

export function actorSnapshot(actor) {
  const roles = ["consumer", "admin", "delivery", "system"];
  if (!roles.includes(actor?.role)) throw new Error("Rol del autor inválido");
  return { id: requiredText(actor.id, "ID del autor"), name: requiredText(actor.name, "Nombre del autor"), role: actor.role };
}
