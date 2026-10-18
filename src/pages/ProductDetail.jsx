import { useState } from "react";
import { formatPrice } from "../data/products";
import { useCart } from "../modules/cart/CartContext";
import { cartItemKey } from "../modules/cart/model.js";
import QuantityControl from "../shared/QuantityControl";
import ProductArtwork from "../components/ProductArtwork";
import { Link } from "../components/Layout";
import "../styles/cart.css";
import { honeys } from "../data/honeyContent";
import { useServices } from "../services/ServicesContext";

export default function ProductDetail({ product }) {
  const honey = honeys.find(item => item.slug === product.slug);
  const { mode } = useServices();
  const initial = product.sizes.find(({ featured }) => featured) ?? product.sizes[0];
  const [sizeLabel, setSizeLabel] = useState(initial.label);
  const size = product.sizes.find(option => option.label === sizeLabel) ?? initial;
  const [quantity, setQuantity] = useState(1);
  const cart = useCart();
  const notice = cart.notice?.key === cartItemKey({ slug: product.slug, format: size.label }) ? cart.notice : null;
  return (
    <section className="section"><nav className="container product-breadcrumbs" aria-label="Ruta de navegación"><Link href="/">Inicio</Link><span aria-hidden="true"> / </span><Link href="/productos">Productos</Link><span aria-hidden="true"> / </span><span aria-current="page">{product.name}</span></nav><div className="container detail-grid">
      <div className="detail-visual" style={{ "--product-color": product.color, "--product-accent": product.accent }}><ProductArtwork product={product} /></div>
      <div className="product-info"><p className="eyebrow">{honey ? `Textura ${honey.texture.toLowerCase()}` : product.eyebrow}</p><h1>{product.name}</h1><p className="price">{formatPrice(size.price)}</p><p className="lead">{honey?.description ?? product.summary}</p><p>{honey?.ritual ?? product.description}</p>
        <fieldset><legend>Elige un formato</legend><div className="size-options">{product.sizes.map((option) => <label key={option.label}><input type="radio" name="size" checked={size.label === option.label} onChange={() => setSizeLabel(option.label)} /><span><strong>{option.label}</strong>{formatPrice(option.price)}</span></label>)}</div></fieldset>
        <div className="product-purchase-actions">
          <QuantityControl quantity={quantity} onChange={setQuantity} />
          <div className="commerce-actions"><button className="button primary" type="button" disabled={!cart.ready} onClick={() => cart.addItem({ slug: product.slug, format: size.label, quantity })}>Agregar al carrito</button><Link className="text-link" href="/carrito">Ver mi carrito ↗</Link></div>
          <p role="status" aria-live="polite">{notice?.text}</p>
          {cart.persistenceError && <p role="status">{cart.persistenceError}</p>}
          {mode === 'demo' && <p className="eyebrow">Compra de demostración · Sin cobros reales</p>}
          <p>Compra sin crear una cuenta. Consulta el costo de despacho al completar tu comuna.</p>
        </div>
        <ul className="chips">{(honey ? [`Textura ${honey.texture.toLowerCase()}`, `Pote de ${size.label}`] : product.notes).map((note) => <li key={note}>{note}</li>)}</ul>
      </div>
    </div></section>
  );
}
