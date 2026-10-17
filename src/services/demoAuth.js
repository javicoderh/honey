const DEMO_USERS = [
  { id: "demo-admin", name: "Administración demo", email: "admin@casamiel.demo", role: "admin", active: true },
  { id: "demo-delivery", name: "Delivery demo", email: "delivery@casamiel.demo", role: "delivery", active: true },
];

// Accesos públicos ficticios, exclusivos del adaptador de demostración.
export function createDemoAuth({ now = Date.now, sessionDuration = 30 * 60 * 1000 } = {}) {
  let session = null;
  return {
    demoAccounts: DEMO_USERS.map(({ email, role }) => ({ email, role, password: "demo1234" })),
    getSession: async () => {
      if (session && Date.parse(session.expiresAt) <= now()) session = null;
      return structuredClone(session);
    },
    login: async ({ email, password }) => {
      const user = DEMO_USERS.find((entry) => entry.email === String(email).trim().toLowerCase());
      if (!user || password !== "demo1234") throw new Error("Correo o contraseña de demostración incorrectos.");
      session = { ...user, expiresAt: new Date(now() + sessionDuration).toISOString() };
      return structuredClone(session);
    },
    logout: async () => { session = null; },
    listMembers: async () => structuredClone(DEMO_USERS),
  };
}
