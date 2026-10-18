import { useEffect, useRef, useState } from "react";
import Layout from "./components/Layout";
import { About, Contact, NotFound } from "./pages/ContentPage";
import AppProviders from "./modules/AppProviders";
import { resolveStoreRoute } from "./modules/store/routes";
import { resolvePurchaseRoute } from "./modules/purchase/routes";
import { resolveStaffRoute } from "./modules/staff/routes";
import RouteSeo from "./seo/RouteSeo";

function resolveRoute(pathname) {
  if (pathname === "/nosotros") return <About />;
  if (pathname === "/contacto") return <Contact />;
  return resolvePurchaseRoute(pathname) ?? resolveStaffRoute(pathname) ?? resolveStoreRoute(pathname) ?? <NotFound />;
}

export default function App({ initialPathname, initialProducts }) {
  const [pathname, setPathname] = useState(() => initialPathname ?? (window.location.pathname.replace(/\/$/, "") || "/"));
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) document.getElementById("contenido")?.focus({ preventScroll: true });
    previousPath.current = pathname;
  }, [pathname]);
  useEffect(() => {
    const update = () => setPathname(window.location.pathname.replace(/\/$/, "") || "/");
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return <AppProviders pathname={pathname} initialProducts={initialProducts}><RouteSeo pathname={pathname} /><Layout pathname={pathname}>{resolveRoute(pathname)}</Layout></AppProviders>;
}
