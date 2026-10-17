import { useState } from "react";
import { formatPrice } from "../data/products";
import { useCart } from "../modules/cart/CartContext";
import { cartItemKey } from "../modules/cart/model.js";
import QuantityControl from "../shared/QuantityControl";
import ProductArtwork from "../components/ProductArtwork";
import { Link } from "../components/Layout";
import "../styles/cart.css";

export default function ProductDetail({ product }) {
  const initial = product.sizes.find(({ featured }) => featured) ?? product.sizes[0];
  const [size, setSize] = useState(initial);
  const [quantity, setQuantity] = useState(1);
  const cart = useCart();
  const notice = cart.notice?.key === cartItemKey({ slug: product.slug, format: size.label }) ? cart.notice : null;
  return (
    <section className="section"><div className="container detail-grid">
      <div className="detail-visual" style={{ "--product-color": product.color, "--product-accent": product.accent }}><ProductArtwork product={product} /></div>
      <div className="product-info"><p className="eyebrow">{product.eyebrow}</p><h1>{product.name}</h1><p className="price">{formatPrice(size.price)}</p><p className="lead">{product.summary}</p><p>{product.description}</p>
        <fieldset><legend>Elige un formato</legend><div className="size-options">{product.sizes.map((option) => <label key={option.label}><input type="radio" name="size" checked={size.label === option.label} onChange={() => setSize(option)} /><span><strong>{option.label}</strong>{formatPrice(option.price)}</span></label>)}</div></fieldset>
        <div className="product-purchase-actions">
          <QuantityControl quantity={quantity} onChange={setQuantity} />
          <div className="commerce-actions"><button className="button primary" type="button" disabled={!cart.ready} onClick={() => cart.addItem({ slug: product.slug, format: size.label, quantity })}>Agregar al carrito</button><Link className="text-link" href="/carrito">Ver mi carrito ↗</Link></div>
          <p role="status" aria-live="polite">{notice?.text}</p>
          {cart.persistenceError && <p role="status">{cart.persistenceError}</p>}
          <p className="eyebrow">Compra de demostración · Sin cobros reales</p>
        </div>
        <ul className="chips">{product.notes.map((note) => <li key={note}>{note}</li>)}</ul>
      </div>
    </div></section>
  );
}
