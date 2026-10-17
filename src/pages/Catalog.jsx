import ProductCard from "../components/ProductCard";
import HoneyCollection, { honeyVarieties } from "../components/HoneyCollection";
import { useCatalog } from "../modules/store/CatalogContext";

export default function Catalog() {
  const { products } = useCatalog();
  const others = products.filter(({ slug }) => !honeyVarieties.some((variety) => variety.slug === slug));
  return (
    <>
      <HoneyCollection />
      <section className="container catalog-more"><details><summary>Más de la colmena <span aria-hidden="true">+</span></summary><div className="product-grid">{others.map((product) => <ProductCard key={product.slug} product={product} />)}</div></details></section>
    </>
  );
}
