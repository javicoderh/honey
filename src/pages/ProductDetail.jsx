import { useState } from "react";
import { formatPrice } from "../data/products";
import WhatsAppLink from "../components/WhatsAppLink";
import QuantityControl from "../shared/QuantityControl";
import ProductArtwork from "../components/ProductArtwork";
import { Link } from "../components/Layout";
import "../styles/cart.css";
import { honeys } from "../data/honeyContent";

export default function ProductDetail({ product }) {
  const honey = honeys.find(item => item.slug === product.slug);
  const initial = product.sizes.find(({ featured }) => featured) ?? product.sizes[0];
  const [sizeLabel, setSizeLabel] = useState(initial.label);
  const size = product.sizes.find(option => option.label === sizeLabel) ?? initial;
  const [quantity, setQuantity] = useState(1);
  return (
    <section className="section"><nav className="container product-breadcrumbs" aria-label="Ruta de navegación"><Link href="/">Inicio</Link><span aria-hidden="true"> / </span><Link href="/productos">Productos</Link><span aria-hidden="true"> / </span><span aria-current="page">{product.name}</span></nav><div className="container detail-grid">
      <div className="detail-visual" style={{ "--product-color": product.color, "--product-accent": product.accent }}><ProductArtwork product={product} /></div>
      <div className="product-info"><p className="eyebrow">{honey ? `Textura ${honey.texture.toLowerCase()}` : product.eyebrow}</p><h1>{product.name}</h1><p className="price">{formatPrice(size.price)}</p><p className="lead">{honey?.description ?? product.summary}</p><p>{honey?.ritual ?? product.description}</p>
        <fieldset><legend>Elige un formato</legend><div className="size-options">{product.sizes.map((option) => <label key={option.label}><input type="radio" name="size" checked={size.label === option.label} onChange={() => setSizeLabel(option.label)} /><span><strong>{option.label}</strong>{formatPrice(option.price)}</span></label>)}</div></fieldset>
        <div className="product-purchase-actions">
          <QuantityControl quantity={quantity} onChange={setQuantity} />
          <div className="commerce-actions"><WhatsAppLink className="button primary" product={product} format={size.label} quantity={quantity} /></div>
          <p>Coordinemos tu pedido y el despacho por WhatsApp.</p>
        </div>
        <ul className="chips">{(honey ? [`Textura ${honey.texture.toLowerCase()}`, `Pote de ${size.label}`] : product.notes).map((note) => <li key={note}>{note}</li>)}</ul>
      </div>
    </div></section>
  );
}
