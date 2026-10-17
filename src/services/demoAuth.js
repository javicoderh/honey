import { createTeamMember, updateTeamMember } from "../modules/staff/model.js";

const DEMO_USERS = [
  { id: "demo-admin", name: "Administración demo", email: "admin@casamiel.demo", role: "admin", active: true },
  { id: "demo-delivery", name: "Delivery demo", email: "delivery@casamiel.demo", role: "delivery", active: true },
];

// Accesos públicos ficticios, exclusivos del adaptador de demostración.
export function createDemoAuth({ now = Date.now, sessionDuration = 30 * 60 * 1000 } = {}) {
  const createdAt = new Date(now()).toISOString();
  const members = structuredClone(DEMO_USERS).map((member) => ({ ...member, accessVersion: 0, createdAt, updatedAt: createdAt, history: [] }));
  let session = null;
  const currentMember = () => {
    if (!session) return null;
    const member = members.find((entry) => entry.id === session.id);
    if (!member?.active || member.accessVersion !== session.accessVersion || Date.parse(session.expiresAt) <= now()) { session = null; return null; }
    return member;
  };
  const requireAdmin = () => {
    const member = currentMember();
    if (member?.role !== "admin") throw new Error("La gestión del equipo requiere una sesión de administración activa");
    return member;
  };
  const publicMember = ({ accessVersion, ...member }) => structuredClone(member);
  const sessionSnapshot = (member) => ({ id: member.id, name: member.name, email: member.email, role: member.role, active: member.active, expiresAt: session.expiresAt });
  return {
    get demoAccounts() { return members.filter((member) => member.active && DEMO_USERS.some((seed) => seed.id === member.id)).map(({ email, role }) => ({ email, role, password: "demo1234" })); },
    getSession: async () => {
      const member = currentMember();
      return member ? sessionSnapshot(member) : null;
    },
    login: async ({ email, password }) => {
      const user = members.find((entry) => entry.email === String(email).trim().toLowerCase());
      if (!user?.active || password !== "demo1234") throw new Error("Correo o contraseña de demostración incorrectos, o cuenta inactiva.");
      session = { id: user.id, accessVersion: user.accessVersion, expiresAt: new Date(now() + sessionDuration).toISOString() };
      return sessionSnapshot(user);
    },
    logout: async () => { session = null; },
    listMembers: async () => { requireAdmin(); return members.map(publicMember); },
    createMember: async (draft) => {
      const member = createTeamMember(members, { id: `demo-staff-${crypto.randomUUID()}`, draft, author: requireAdmin(), at: new Date(now()).toISOString() });
      members.push(member);
      return publicMember(member);
    },
    updateMember: async (id, changes) => {
      const actor = requireAdmin();
      const updated = updateTeamMember(members, id, { changes, author: actor, at: new Date(now()).toISOString() });
      members[members.findIndex((entry) => entry.id === id)] = updated;
      return publicMember(updated);
    },
  };
}
