import { useEffect } from 'react';
import { useCatalog } from '../modules/store/CatalogContext';
import { useServices } from '../services/ServicesContext';
import { getRouteSeo, renderHead, SEO_INDEXING } from './model.js';

function Metadata({ seo }) {
  const html = renderHead(seo);
  useEffect(() => {
    document.head.querySelectorAll('[data-seo], title, meta[name="description"], meta[name="robots"], link[rel="canonical"]').forEach(element => element.remove());
    const template = document.createElement('template');
    template.innerHTML = html;
    document.head.append(template.content);
  }, [html]);
  return null;
}
function StoreSeo({ pathname }) {
  const { products } = useCatalog();
  const { mode } = useServices();
  return <Metadata seo={getRouteSeo(pathname, { products, indexing: SEO_INDEXING && mode === 'api' })} />;
}
export default function RouteSeo({ pathname }) {
  return pathname === '/staff' || pathname.startsWith('/staff/') ? <Metadata seo={getRouteSeo(pathname)} /> : <StoreSeo pathname={pathname} />;
}
