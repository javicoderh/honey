import { useContext } from "react";

export function useModuleContext(context, name) {
  const value = useContext(context);
  if (!value) throw new Error(`Este módulo necesita ${name}Provider`);
  return value;
}
