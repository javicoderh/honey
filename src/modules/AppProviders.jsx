import { ServicesProvider } from "../services/ServicesContext";
import { CatalogProvider } from "./store/CatalogContext";
import { CartProvider } from "./cart/CartContext";
import { PurchaseProvider } from "./purchase/PurchaseContext";
import { PaymentProvider } from "./payments/PaymentContext";
import { SessionProvider } from "./staff/SessionContext";
import { OrdersProvider } from "./orders/OrdersContext";
import { TeamProvider } from "./staff/TeamContext";

function StaffProviders({ pathname, children }) {
  const needsTeam = ["/staff/admin", "/staff/admin/equipo"].includes(pathname) || pathname.startsWith("/staff/admin/despachos");
  return <SessionProvider><OrdersProvider>{needsTeam ? <TeamProvider>{children}</TeamProvider> : children}</OrdersProvider></SessionProvider>;
}

function StoreProviders({ pathname, children }) {
  return <CatalogProvider><CartProvider><PurchaseProvider>{pathname.startsWith("/checkout") ? <PaymentProvider>{children}</PaymentProvider> : children}</PurchaseProvider></CartProvider></CatalogProvider>;
}

export default function AppProviders({ pathname, adapter, children }) {
  const isStaff = pathname === "/staff" || pathname.startsWith("/staff/");
  return <ServicesProvider adapter={adapter}>{isStaff ? <StaffProviders pathname={pathname}>{children}</StaffProviders> : <StoreProviders pathname={pathname}>{children}</StoreProviders>}</ServicesProvider>;
}
