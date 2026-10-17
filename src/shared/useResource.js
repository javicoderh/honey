import { useCallback, useEffect, useState } from "react";

// Una carga por contexto. Descarta respuestas de una carga anterior o desmontada.
export function useResource(load, initialValue, enabled = true) {
  const [data, setData] = useState(initialValue);
  const [status, setStatus] = useState(enabled ? "loading" : "idle");
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) { setStatus("idle"); return; }
    let active = true;
    setStatus("loading");
    setError(null);
    Promise.resolve().then(load).then((result) => {
      if (active) { setData(result); setStatus("ready"); }
    }).catch((cause) => {
      if (active) { setError(cause); setStatus("error"); }
    });
    return () => { active = false; };
  }, [load, revision, enabled]);

  return { data, status, error, refresh };
}
