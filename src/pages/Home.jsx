import { useRef, useState } from "react";
import HoneyLabel from "../components/HoneyLabel";
import HoneyQuickView from "../components/HoneyQuickView";
import { useCatalog } from "../modules/store/CatalogContext";
import "../styles/home-art.css";
import { honeys } from "../data/honeyContent";
import { useCart } from "../modules/cart/CartContext";
export default function Home() {
  const [selected, setSelected] = useState(null);
  const trigger = useRef(null);
  const catalog = useCatalog();
  const cart = useCart();
  const product = selected && catalog.getProduct(selected.slug);
  return <>
    <section className="honey-dream" aria-labelledby="dream-title">
      <figure className="honey-dream__canvas"><img src="/art/jardin-de-miel.png" alt="Un jardín imaginario: abejas entre flores, islas flotantes y ríos de miel sobre un paisaje pintado de Chile." width="1536" height="1024" fetchPriority="high" /></figure>
      <div className="container honey-dream__inner">
        <div className="honey-dream__copy">
          <p className="eyebrow">Casa Miel · De la colmena Puconina a tu mesa</p>
          <h1 id="dream-title">Hay un mundo<br />en cada <em>gota.</em></h1>
          <p className="honey-dream__description">Mieles chilenas para descubrir con calma.<br />Elige tu sabor, encuentra tu pequeño ritual.</p>
        </div>
        <div className="honey-dream__collection" aria-label="Nuestras tres mieles">
          {honeys.map((honey, index) => <button type="button" className={`honey-dream__honey honey-dream__honey--${honey.id}`} key={honey.id} aria-haspopup="dialog" aria-label={`Descubrir miel ${honey.name.toLowerCase()}`} disabled={!cart.ready || !catalog.getProduct(honey.slug)} onClick={event => { trigger.current = event.currentTarget; setSelected(honey); }}>
            <img src={`/art/miel-${honey.id}.png`} alt="" width="1024" height="1024" />
            <HoneyLabel index={index} texture={honey.texture} name={honey.name} />
          </button>)}
        </div>
      </div>
    </section>
    {product && <HoneyQuickView key={product.slug} honey={selected} product={product} onClose={() => { setSelected(null); trigger.current?.focus({ preventScroll: true }); }} />}
  </>;
}
