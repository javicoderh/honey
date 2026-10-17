import { createContext, useCallback } from "react";
import { useServices } from "../../services/ServicesContext";
import { useResource } from "../../shared/useResource";
import { useModuleContext } from "../../shared/useModuleContext";
import { useSession } from "./SessionContext";

const TeamContext = createContext(null);

export function TeamProvider({ children }) {
  const services = useServices();
  const { session, isAuthenticated } = useSession();
  const identity = isAuthenticated && session.role === "admin" ? session.id : null;
  const load = useCallback(async () => ({ identity, members: await services.staff.list() }), [services, identity]);
  const { data, status, error, refresh } = useResource(load, null, Boolean(identity));
  const members = identity && data?.identity === identity ? data.members : [];
  return <TeamContext.Provider value={{ members, status, error, refreshTeam: refresh }}>{children}</TeamContext.Provider>;
}

export const useTeam = () => useModuleContext(TeamContext, "Team");
