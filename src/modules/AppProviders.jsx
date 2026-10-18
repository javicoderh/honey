import { ServicesProvider } from "../services/ServicesContext";
import { CatalogProvider } from "./store/CatalogContext";
import { CartProvider } from "./cart/CartContext";
import { PurchaseProvider } from "./purchase/PurchaseContext";
import { PaymentProvider } from "./payments/PaymentContext";
import { SessionProvider } from "./staff/SessionContext";
import { OrdersProvider } from "./orders/OrdersContext";
import { TeamProvider } from "./staff/TeamContext";
import { SavedCartProvider } from './cart/SavedCartContext';
import { MarketingProvider } from './marketing/MarketingContext';

function StaffProviders({ pathname, children }) {
  const needsTeam = ["/staff/admin", "/staff/admin/equipo"].includes(pathname) || pathname.startsWith("/staff/admin/despachos");
  const content=pathname==='/staff/admin/marketing'?<MarketingProvider>{children}</MarketingProvider>:children;
  return <SessionProvider><OrdersProvider>{needsTeam ? <TeamProvider>{content}</TeamProvider> : content}</OrdersProvider></SessionProvider>;
}

function StoreProviders({ pathname, initialProducts, children }) {
  return <CatalogProvider initialProducts={initialProducts}><CartProvider><SavedCartProvider><PurchaseProvider>{pathname.startsWith("/checkout") ? <PaymentProvider>{children}</PaymentProvider> : children}</PurchaseProvider></SavedCartProvider></CartProvider></CatalogProvider>;
}

export default function AppProviders({ pathname, adapter, initialProducts, children }) {
  const isStaff = pathname === "/staff" || pathname.startsWith("/staff/");
  return <ServicesProvider adapter={adapter}>{isStaff ? <StaffProviders pathname={pathname}>{children}</StaffProviders> : <StoreProviders pathname={pathname} initialProducts={initialProducts}>{children}</StoreProviders>}</ServicesProvider>;
}
