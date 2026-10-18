import { createContext } from "react";
import { useServices } from "../../services/ServicesContext";
import { useResource } from "../../shared/useResource";
import { useModuleContext } from "../../shared/useModuleContext";
import { StateMessage, ActionButton } from "../../shared/ui";

const CatalogContext = createContext(null);

export function CatalogProvider({ children, initialProducts }) {
  const services = useServices();
  const { data: products, status, error, refresh } = useResource(services.catalog.list, initialProducts ?? [], true, Boolean(initialProducts));
  const getProduct = (slug) => products.find((product) => product.slug === slug);
  return <CatalogContext.Provider value={{ products, status, error, getProduct, refreshProducts: refresh, retry: refresh }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  return useModuleContext(CatalogContext, "Catalog");
}

export function CatalogBoundary({ children }) {
  const { status, retry } = useCatalog();
  if (status === "loading") return <div className="container commerce-page"><StateMessage title="Cargando la colmena…" /></div>;
  if (status === "error") return <div className="container commerce-page"><StateMessage title="No pudimos cargar los productos" kind="error">Inténtalo nuevamente.</StateMessage><ActionButton onClick={retry}>Reintentar</ActionButton></div>;
  return children;
}
