import { useCallback, useEffect, useState } from "react";

// Una carga por contexto. Descarta respuestas de una carga anterior o desmontada.
export function useResource(load, initialValue, enabled = true, seeded = false) {
  const [data, setData] = useState(initialValue);
  const [status, setStatus] = useState(enabled ? (seeded ? "ready" : "loading") : "idle");
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) { setStatus("idle"); return; }
    let active = true;
    // El catálogo prerenderizado permanece visible mientras se actualiza.
    setStatus(current => seeded && current === "ready" ? current : "loading");
    setError(null);
    Promise.resolve().then(load).then((result) => {
      if (active) { setData(result); setStatus("ready"); }
    }).catch((cause) => {
      if (active) { setError(cause); setStatus("error"); }
    });
    return () => { active = false; };
  }, [load, revision, enabled, seeded]);

  return { data, status, error, refresh };
}
