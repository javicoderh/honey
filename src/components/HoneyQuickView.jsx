import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatPrice } from "../data/products";
import { useCart } from "../modules/cart/CartContext";
import { cartItemKey } from "../modules/cart/model.js";
import { Link } from "./Layout";
import "../styles/honey-quick-view.css";

export default function HoneyQuickView({ honey, product, onClose }) {
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const timer = useRef(null);
  const [closing, setClosing] = useState(false);
  const [added, setAdded] = useState(false);
  const [format, setFormat] = useState((product.sizes.find(size => size.featured) ?? product.sizes[0]).label);
  const size = product.sizes.find(size => size.label === format);
  const cart = useCart();
  const notice = added && cart.notice?.key === cartItemKey({ slug: product.slug, format }) ? cart.notice : null;
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const element = dialog.current;
    element.showModal();
    closeButton.current.focus({ preventScroll: true });
    return () => {
      clearTimeout(timer.current);
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  function close() {
    if (closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onClose(); return; }
    setClosing(true);
    timer.current = setTimeout(onClose, 360);
  }
  return createPortal(
    <dialog ref={dialog} className={`honey-quick-view honey-quick-view--${honey.id}${closing ? " is-closing" : ""}`} aria-labelledby="honey-quick-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}>
      <button ref={closeButton} className="honey-quick-view__close" type="button" aria-label="Cerrar detalle de miel" onClick={close}>✕</button>
      <div className="honey-quick-view__scroll">
        <div className="honey-quick-view__art" aria-hidden="true">
          <span className="honey-quick-view__edition">CASA MIEL / LA COLECCIÓN</span>
          <span className="honey-quick-view__vertical">MIEL</span>
          <div className="honey-quick-view__halo" />
          <img src={`/art/miel-${honey.id}.png`} alt="" width="1024" height="1024" />
          <span className="honey-quick-view__name">{honey.name}</span>
          <span className="honey-quick-view__texture">Textura {honey.texture.toLowerCase()} · {size.label}</span>
        </div>
        <div className="honey-quick-view__info">
          <p className="honey-quick-view__eyebrow">De la colmena a tu ritual</p>
          <h2 id="honey-quick-title">{product.name}</h2>
          <p className="honey-quick-view__headline">{honey.headline}</p>
          <p className="honey-quick-view__description">{honey.description}</p>
          <p className="honey-quick-view__ritual">{honey.ritual}</p>
          <Link className="honey-quick-view__more" href={`/productos/${product.slug}`}>Conoce más sobre esta miel <span aria-hidden="true">↗</span></Link>
          <div className="honey-quick-view__purchase">
            <div className="honey-quick-view__price"><strong>{formatPrice(size.price)}</strong>{product.sizes.length > 1 ? <label>Formato <select value={format} onChange={event => { setFormat(event.target.value); setAdded(false); }}>{product.sizes.map(option => <option key={option.label}>{option.label}</option>)}</select></label> : <span>Pote de {size.label}</span>}</div>
            <button className="honey-quick-view__add" type="button" disabled={!cart.ready || closing} onClick={() => { cart.addItem({ slug: product.slug, format, quantity: 1 }); setAdded(true); }}>Agregar al carrito <span aria-hidden="true">＋</span></button>
            <p className="honey-quick-view__notice" role="status">{notice?.text}{cart.persistenceError && ` ${cart.persistenceError}`}</p>
            {notice && <Link className="honey-quick-view__cart" href="/carrito">Ver mi carrito →</Link>}
          </div>
        </div>
      </div>
    </dialog>, document.body,
  );
}
