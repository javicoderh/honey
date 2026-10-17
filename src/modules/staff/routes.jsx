import StaffShell from "./StaffShell";
import ServiceModulePage from "./ServiceModulePage";
import OrdersPage from "../orders/OrdersPage";
import OrderDetailPage from "../orders/OrderDetailPage";
import SalesPage from "../sales/SalesPage";
import DeliveriesPage, { DeliveryDashboard } from "../deliveries/DeliveriesPage";
import { useEffect, useState } from "react";
import { AccessCard, ActionButton, DetailPanel, FormField, StateMessage } from "../../shared/ui";
import { Link } from "../../components/Layout";
import { useTeam } from "./TeamContext";
import { useSession } from "./SessionContext";
import { useOrders } from "../orders/OrdersContext";
import { canAccessStaff, staffHome } from "./access.js";
import { navigate } from "../../router";
import { canPrepareOrder } from "../orders/model.js";

function RedirectHome({ role }) {
  const href = staffHome(role);
  useEffect(() => {
    window.history.replaceState({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [href]);
  return <StateMessage title="Abriendo tu panel…"><Link href={href}>Continuar</Link></StateMessage>;
}

export function StaffAccess({ pathname, auth, children }) {
  if (auth.status === "loading") return <StaffShell title="Acceso del equipo"><StateMessage title="Comprobando sesión…" /></StaffShell>;
  if (auth.status === "error") return <StaffShell title="Acceso del equipo"><StateMessage title="No pudimos comprobar tu sesión" kind="error">{auth.error}</StateMessage><ActionButton onClick={auth.refreshSession}>Reintentar</ActionButton></StaffShell>;
  if (pathname === "/staff") return auth.isAuthenticated ? <StaffShell title="Acceso del equipo"><RedirectHome role={auth.session.role} /></StaffShell> : children;
  if (!auth.isAuthenticated) return <StaffShell title={auth.reason === "expired" ? "Tu sesión venció" : "Inicia sesión para continuar"}><StateMessage title="Acceso exclusivo del equipo">Ingresa desde el acceso staff para abrir tu panel.</StateMessage><Link className="commerce-button" href="/staff">Iniciar sesión</Link></StaffShell>;
  if (!canAccessStaff(auth.session.role, pathname)) return <StaffShell title="Acceso denegado"><StateMessage title="Tu rol no tiene acceso a esta sección" kind="error" /><Link className="commerce-button" href={staffHome(auth.session.role)}>Ir a mi panel</Link></StaffShell>;
  return children;
}

function StaffGate({ pathname, children }) {
  return <StaffAccess pathname={pathname} auth={useSession()}>{children}</StaffAccess>;
}

function StaffEntry() {
  const auth = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) found.email = "Ingresa un correo válido.";
    if (!password) found.password = "Ingresa la contraseña.";
    setErrors(found);
    if (Object.keys(found).length) { requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus()); return; }
    const session = await auth.login({ email, password });
    setPassword("");
    if (session) navigate({ preventDefault() {} }, staffHome(session.role));
  };
  return <StaffShell title="Acceso del equipo" description="Administración y entregas de Casa Miel.">
    {auth.reason === "expired" && <StateMessage title="Tu sesión venció">Vuelve a iniciar sesión para continuar.</StateMessage>}
    {auth.reason === "logout" && <StateMessage title="Sesión cerrada" />}
    <DetailPanel title="Iniciar sesión"><form noValidate onSubmit={submit}><fieldset className="staff-login-fields" disabled={auth.busy}><FormField label="Correo" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} required /><FormField label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} error={errors.password} required />{auth.error && <StateMessage title={auth.error} kind="error" />}<ActionButton type="submit" disabled={auth.busy}>{auth.busy ? "Ingresando…" : "Iniciar sesión"}</ActionButton></fieldset></form></DetailPanel>
    {auth.demoAccounts?.length > 0 && <DetailPanel title="Cuentas de demostración"><p>Accesos ficticios y públicos. La sesión dura 30 minutos y se reinicia al recargar.</p>{auth.demoAccounts.map((account) => <div className="staff-demo-account" key={account.role}><p><strong>{account.role === "admin" ? "Admin" : "Delivery"}</strong><br />{account.email}<br />Contraseña: {account.password}</p><ActionButton variant="secondary" disabled={auth.busy} onClick={() => { setEmail(account.email); setPassword(account.password); setErrors({}); }}>Usar cuenta {account.role}</ActionButton></div>)}</DetailPanel>}
  </StaffShell>;
}

export function AdminDashboard() {
  const { orders, status, getSales } = useOrders();
  const { members, status: teamStatus } = useTeam();
  const count = (value) => status === "ready" ? value : "—";
  return <StaffShell title="Panel de administración" description="Elige una sección para comenzar."><div className="access-grid"><AccessCard href="/staff/admin/pedidos" title="Pedidos" description={`${count(orders.length)} registrados`} /><AccessCard href="/staff/admin/ventas" title="Ventas / Facturación" description={`${count(getSales().filter((sale) => sale.payment.status === "approved").length)} pagos aprobados`} /><AccessCard href="/staff/admin/despachos" title="Despachos" description={`${count(orders.filter((order) => canPrepareOrder(order) && order.delivery.status !== "delivered").length)} entregas pendientes`} /><AccessCard href="/staff/admin/equipo" title="Equipo" description={`${teamStatus === "ready" ? members.filter((member) => member.active).length : "—"} integrantes activos`} /></div>{status === "error" && <StateMessage title="No pudimos cargar los contadores de pedidos" kind="error" />}{teamStatus === "error" && <StateMessage title="No pudimos cargar el contador de equipo" kind="error" />}</StaffShell>;
}

function TeamPage() {
  const { members, status } = useTeam();
  return <ServiceModulePage title="Equipo" description="Cuentas y roles del equipo." resource={{ records: members, status }} />;
}

const routes = {
  "/staff": StaffEntry,
  "/staff/admin": AdminDashboard,
  "/staff/admin/pedidos": OrdersPage,
  "/staff/admin/ventas": SalesPage,
  "/staff/admin/despachos": DeliveriesPage,
  "/staff/admin/equipo": TeamPage,
  "/staff/delivery": DeliveryDashboard,
};

export function resolveStaffRoute(pathname) {
  const detail = pathname.match(/^\/staff\/admin\/pedidos\/([^/]+)$/);
  if (detail) {
    let id;
    try { id = decodeURIComponent(detail[1]); } catch { return null; }
    return <StaffGate pathname={pathname}><OrderDetailPage key={id} id={id} /></StaffGate>;
  }
  const Page = routes[pathname];
  return Page ? <StaffGate pathname={pathname}><Page key={pathname} /></StaffGate> : null;
}
