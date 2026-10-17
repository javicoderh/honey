import { createContext, useCallback, useRef, useState } from "react";
import { useServices } from "../../services/ServicesContext";
import { useResource } from "../../shared/useResource";
import { useModuleContext } from "../../shared/useModuleContext";
import { useSession } from "./SessionContext";

const TeamContext = createContext(null);

export function TeamProvider({ children }) {
  const services = useServices();
  const { session, isAuthenticated, refreshSession } = useSession();
  const identity = isAuthenticated && session.role === "admin" ? session.id : null;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const lock = useRef(false);
  const [mutation, setMutation] = useState(null);
  const load = useCallback(async () => ({ identity, members: await services.staff.list() }), [services, identity]);
  const { data, status, error, refresh } = useResource(load, null, Boolean(identity));
  const members = identity && data?.identity === identity ? data.members : [];
  const mutate = async (type, id, payload) => {
    if (lock.current || !identity) return { ok: false };
    lock.current = true;
    const actorId = identity;
    setMutation({ type, id, identity, busy: true });
    try {
      const member = type === "create" ? await services.staff.create(payload) : await services.staff.update(id, payload);
      if (currentIdentity.current !== actorId) return { ok: false };
      setMutation({ type, id: member.id, identity, busy: false, message: type === "create" ? (services.mode === 'demo' ? "Cuenta de demostración creada." : "Cuenta creada.") : "Acceso actualizado." });
      refresh();
      if (id === session.id && (member.role !== session.role || !member.active)) await refreshSession("access_changed");
      return { ok: true, member };
    } catch (cause) {
      if (currentIdentity.current === actorId) setMutation({ type, id, identity, busy: false, error: cause.message });
      return { ok: false };
    } finally { lock.current = false; }
  };
  return <TeamContext.Provider value={{ members, status: identity && data?.identity !== identity ? "loading" : status, error, refreshTeam: refresh,
    createMember: (draft) => mutate("create", null, draft), updateMember: (id, changes) => mutate("update", id, changes), mutation: mutation?.identity === identity ? mutation : null }}>{children}</TeamContext.Provider>;
}

export const useTeam = () => useModuleContext(TeamContext, "Team");
