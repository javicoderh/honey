import { formatPrice, startingPrice } from "../data/products";
import { Link } from "./Layout";

export default function ProductCard({ product }) {
  return (
    <article className="product-card">
      <Link href={`/productos/${product.slug}`}>
        <div className="product-visual" style={{ "--product-color": product.color, "--product-accent": product.accent }}>
          <span className="jar"><i /></span>
        </div>
        <div className="product-card-body">
          <p className="eyebrow">{product.eyebrow}</p>
          <div className="product-heading"><h3>{product.name}</h3><strong>Desde {formatPrice(startingPrice(product))}</strong></div>
          <p>{product.summary}</p>
          <span className="text-link">Conocer producto →</span>
        </div>
      </Link>
    </article>
  );
}
