import { useState } from "react";
import { useCart } from "./CartContext";
import { Link } from "../../components/Layout";
import ProductArtwork from "../../components/ProductArtwork";
import { formatPrice } from "../../data/products";
import { ActionButton, ConfirmDialog, DemoNotice, StateMessage } from "../../shared/ui";
import QuantityControl from "../../shared/QuantityControl";
import "../../styles/cart.css";
import SavedCartPanel,{ SavedCartLink } from './SavedCartPanel';

export function CartContents({ cart }) {
  const [confirmClear, setConfirmClear] = useState(false);
  if (cart.status === "loading") return <StateMessage title="Cargando tus productos…" />;
  if (cart.status === "error") return <StateMessage title="No pudimos consultar los precios" kind="error">Tus productos siguen guardados. Recarga la página para volver a intentarlo.</StateMessage>;
  if (!cart.items.length) return <div className="cart-empty"><span aria-hidden="true">✿</span><h2>Tu próxima favorita te espera.</h2><p>Agrega una miel para empezar a llenar tu carrito.</p><Link className="commerce-button commerce-button--primary" href="/productos">Descubrir las mieles ↗</Link></div>;
  return <div className="cart-layout">
    <section aria-label="Productos del carrito"><ul className="cart-items">{cart.items.map((item) => <li className="cart-item" key={item.key}>
      <div className="cart-item__art">{item.product ? <ProductArtwork product={item.product} /> : <span aria-hidden="true">—</span>}</div>
      <div className="cart-item__info"><h2>{item.product ? <Link href={`/productos/${item.slug}`}>{item.name}</Link> : item.name}</h2><p className="cart-item__format">{item.format}</p>
        <p>{item.available ? `${formatPrice(item.unitPrice)} por unidad` : "Este producto o formato ya no está disponible. Quítalo para continuar."}</p>
        <QuantityControl label={`Cantidad de ${item.name}, ${item.format}`} quantity={item.quantity} onChange={(quantity) => cart.updateQuantity(item.key, quantity)} />
        <button className="cart-remove" type="button" onClick={() => cart.removeItem(item.key)} aria-label={`Quitar ${item.name}, ${item.format}`}>Quitar</button>
      </div><strong className="cart-item__total">{item.available ? formatPrice(item.lineTotal) : "No disponible"}</strong>
    </li>)}</ul><div className="commerce-actions"><Link className="text-link" href="/productos">← Seguir eligiendo</Link><button className="cart-remove" type="button" onClick={() => setConfirmClear(true)}>Vaciar carrito</button></div></section>
    <aside className="cart-summary" aria-labelledby="cart-summary-title"><p className="eyebrow">Tu selección</p><h2 id="cart-summary-title">Resumen de compra</h2><dl><div><dt>Productos ({cart.itemCount})</dt><dd>{formatPrice(cart.subtotal)}</dd></div><div><dt>Despacho</dt><dd>Por calcular</dd></div><div className="cart-summary__total"><dt>Total de productos</dt><dd>{formatPrice(cart.subtotal)}</dd></div></dl><p>El despacho se confirmará antes del pago. Compras sin crear una cuenta.</p>
      {cart.canCheckout ? <Link className="commerce-button commerce-button--primary" href="/checkout">Continuar con mi compra ↗</Link> : <><StateMessage title="Revisa los productos no disponibles" /><ActionButton disabled>Continuar con mi compra</ActionButton></>}
    </aside>
    <ConfirmDialog open={confirmClear} title="¿Vaciar tu carrito?" confirmLabel="Vaciar carrito" onClose={() => setConfirmClear(false)} onConfirm={() => { setConfirmClear(false); cart.clearCart(); }}><p>Se quitarán todos los productos de tu selección.</p></ConfirmDialog>
  </div>;
}

export default function CartPage() {
  const cart = useCart();
  return <section className="container commerce-page cart-page"><DemoNotice /><header className="commerce-heading"><p className="eyebrow">Casa Miel · Tu selección</p><h1>Un pequeño ritual, a tu gusto.</h1><p>Revisa tus mieles antes de continuar.</p></header>
    {cart.persistenceError && <StateMessage title="Guardado del carrito">{cart.persistenceError}</StateMessage>}
    {cart.notice?.kind === "error" && <StateMessage title={cart.notice.text} kind="error" />}
    <SavedCartLink />
    <CartContents cart={cart} />
    <SavedCartPanel />
  </section>;
}
