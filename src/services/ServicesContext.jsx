import { createContext, useContext, useMemo } from "react";
import { createServices, services } from "./index";

const ServicesContext = createContext(null);

export function ServicesProvider({ adapter = services, children }) {
  const value = useMemo(() => createServices(adapter), [adapter]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices() {
  const value = useContext(ServicesContext);
  if (!value) throw new Error("Los módulos necesitan ServicesProvider");
  return value;
}
