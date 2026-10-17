import Home from "../../pages/Home";
import Catalog from "../../pages/Catalog";
import ProductDetail from "../../pages/ProductDetail";
import { NotFound } from "../../pages/ContentPage";
import { CatalogBoundary, useCatalog } from "./CatalogContext";

function ProductRoute({ slug }) {
  const { products } = useCatalog();
  const product = products.find((item) => item.slug === slug);
  return product ? <ProductDetail key={slug} product={product} /> : <NotFound />;
}

export function resolveStoreRoute(pathname) {
  if (pathname === "/") return <CatalogBoundary><Home /></CatalogBoundary>;
  if (pathname === "/productos") return <CatalogBoundary><Catalog /></CatalogBoundary>;
  const match = pathname.match(/^\/productos\/([^/]+)$/);
  if (match) return <CatalogBoundary><ProductRoute slug={match[1]} /></CatalogBoundary>;
  return null;
}
