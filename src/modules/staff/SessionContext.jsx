import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../services/ServicesContext";
import { useModuleContext } from "../../shared/useModuleContext";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const services = useServices();
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(null);
  const [views, setViews] = useState({});
  const version = useRef(0);
  const currentSession = useRef(null);
  currentSession.current = session;
  const lock = useRef(false);
  const refreshSession = useCallback(async () => {
    const revision = ++version.current;
    try {
      const result = await services.auth.getSession();
      if (revision !== version.current) return;
      if (currentSession.current && !result) { setReason("expired"); setViews({}); }
      setSession(result);
      setStatus("ready"); setError(null);
    } catch (cause) {
      if (revision !== version.current) return;
      setSession(null); setStatus("error"); setError(cause.message); setViews({});
    }
  }, [services]);
  useEffect(() => { refreshSession(); return () => { version.current++; }; }, [refreshSession]);
  useEffect(() => {
    if (!session?.expiresAt) return;
    const expire = () => {
      if (Date.parse(session.expiresAt) <= Date.now()) {
        version.current++; setSession(null); setReason("expired"); setViews({});
      }
    };
    const timer = setInterval(expire, 1000);
    window.addEventListener("focus", expire);
    return () => { clearInterval(timer); window.removeEventListener("focus", expire); };
  }, [session]);
  const login = async (credentials) => {
    if (lock.current) return null;
    lock.current = true; version.current++; setBusy(true); setError(null);
    try {
      const result = await services.auth.login(credentials);
      if (!["admin", "delivery"].includes(result?.role) || result.active === false) throw new Error("Esta cuenta no tiene un rol de acceso activo.");
      setSession(result); setStatus("ready"); setReason(null); setViews({});
      return result;
    } catch (cause) { setError(cause.message); return null; }
    finally { lock.current = false; setBusy(false); }
  };
  const logout = async () => {
    if (lock.current) return false;
    lock.current = true; version.current++; setBusy(true); setError(null);
    try { await services.auth.logout(); setSession(null); setStatus("ready"); setReason("logout"); setViews({}); return true; }
    catch (cause) { setError(cause.message); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  const updateView = (key, changes) => setViews((current) => ({ ...current, [key]: { ...current[key], ...changes } }));
  return <SessionContext.Provider value={{ session, status, error, busy, reason, login, logout, isAuthenticated: status === "ready" && Boolean(session), refreshSession, views, updateView, demoAccounts: services.mode === "demo" ? services.auth.demoAccounts : [] }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useModuleContext(SessionContext, "Session");
