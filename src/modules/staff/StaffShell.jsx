import { Link } from "../../components/Layout";
import { ActionButton, DemoNotice, StateMessage } from "../../shared/ui";
import { useSession } from "./SessionContext";
import { navigate } from "../../router";

export default function StaffShell({ title, description, back, children, backLabel = "Volver al panel" }) {
  const { session, isAuthenticated, logout, busy, error } = useSession();
  return <section className="container commerce-page staff-page"><DemoNotice />{isAuthenticated && <div className="staff-session"><span>{session.name} · {session.role === "admin" ? "Admin" : "Delivery"}</span><ActionButton variant="secondary" disabled={busy} onClick={async () => { if (await logout()) navigate({ preventDefault() {} }, "/staff"); }}>{busy ? "Cerrando…" : "Cerrar sesión"}</ActionButton></div>}{isAuthenticated && error && <StateMessage title={error} kind="error" />}<header className="commerce-heading">{back && <Link className="text-link" href={back}>← {backLabel}</Link>}<p className="eyebrow">Casa Miel · Equipo</p><h1>{title}</h1>{description && <p>{description}</p>}</header>{children}</section>;
}
