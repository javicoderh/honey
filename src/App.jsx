import { useEffect, useState } from "react";
import Layout from "./components/Layout";
import { About, Contact, NotFound } from "./pages/ContentPage";
import AppProviders from "./modules/AppProviders";
import { resolveStoreRoute } from "./modules/store/routes";
import { resolvePurchaseRoute } from "./modules/purchase/routes";
import { resolveStaffRoute } from "./modules/staff/routes";

function resolveRoute(pathname) {
  if (pathname === "/nosotros") return <About />;
  if (pathname === "/contacto") return <Contact />;
  return resolvePurchaseRoute(pathname) ?? resolveStaffRoute(pathname) ?? resolveStoreRoute(pathname) ?? <NotFound />;
}

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname.replace(/\/$/, "") || "/");
  useEffect(() => {
    const update = () => setPathname(window.location.pathname.replace(/\/$/, "") || "/");
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return <AppProviders pathname={pathname}><Layout pathname={pathname}>{resolveRoute(pathname)}</Layout></AppProviders>;
}
