import { navigate } from "../router";
import { useCartCount } from "../modules/cart/CartContext";

const links = [
  ["/productos", "Productos"],
  ["/nosotros", "Origen"],
  ["/contacto", "Contacto"],
];

function Link({ href, children, className = "", ...props }) {
  return <a {...props} className={className} href={href} onClick={(event) => navigate(event, href)}>{children}</a>;
}

export default function Layout({ children, pathname }) {
  const itemCount = useCartCount();
  return (
    <div className={pathname === "/" ? "site-layout site-layout--landing" : "site-layout"}>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" href="/"><span className="brand-mark">H</span> Casa Miel</Link>
          <nav aria-label="Navegación principal">
            {links.map(([href, label]) => (
              <Link key={href} className={pathname.startsWith(href) ? "active" : ""} href={href}>{label}</Link>
            ))}
          </nav>
          <Link className="cart-link" href="/carrito" aria-label={`Carrito, ${itemCount} productos`}>Carrito <span aria-live="polite" aria-atomic="true">{itemCount}</span></Link>
        </div>
      </header>
      <main id="contenido" tabIndex={-1}>{children}</main>
      {pathname !== "/" && <footer className="site-footer">
        <div className="container footer-grid">
          <div><p className="brand"><span className="brand-mark">H</span> Casa Miel</p><p>Mieles chilenas con origen y carácter propio.</p></div>
          <div><strong>Explorar</strong><Link href="/productos">Productos</Link><Link href="/nosotros">Nuestro origen</Link></div>
          <div><strong>Ayuda</strong><Link href="/contacto">Contacto</Link><Link href="/contacto">Preguntas frecuentes</Link><Link href="/staff">Acceso equipo</Link></div>
        </div>
      </footer>}
    </div>
  );
}

export { Link };
