import { useEffect, useId, useRef, useState } from "react";
import HoneyLabel from "./HoneyLabel";
import { Link } from "./Layout";
import { formatPrice } from "../data/products";
import { useCatalog } from "../modules/store/CatalogContext";
import "../styles/catalog.css";

export const honeyVarieties = [
  { slug: "miel-multifloral", image: "multifloral", texture: "Dura", description: "Distintas floraciones, una textura firme. Encuentra tu momento para disfrutarla." },
  { slug: "miel-de-cerezo", image: "cerezo", texture: "Cremosa", description: "Una miel de textura cremosa para acompañar tus pequeños rituales." },
  { slug: "miel-de-avellana", image: "avellana", texture: "Cremosa", description: "Otra forma de disfrutar la miel, con la textura cremosa que te gusta." },
];

function Honey({ variety, index }) {
  const { products } = useCatalog();
  const articleRef = useRef(null);
  const triggerRef = useRef(null);
  const product = products.find(({ slug }) => slug === variety.slug);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const visible = expanded || hovered || focused;
  const panelId = useId();
  useEffect(() => {
    if (!expanded) return;
    const closeOutside = (event) => {
      if (!articleRef.current?.contains(event.target)) {
        setExpanded(false);
        setHovered(false);
        setFocused(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [expanded]);
  return (
    <article ref={articleRef} className={`catalog-honey${visible ? " is-active" : ""}`}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) => { if (event.target.matches(":focus-visible")) setFocused(true); }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setFocused(false); setExpanded(false); } }}
      onKeyDown={(event) => { if (event.key === "Escape") { triggerRef.current?.focus({ preventScroll: true }); setExpanded(false); setHovered(false); setFocused(false); } }}>
      <button ref={triggerRef} className="catalog-honey__trigger" type="button" aria-expanded={visible} aria-controls={panelId} onClick={() => setExpanded(!expanded)}>
        <span className="catalog-honey__art"><img src={`/art/miel-${variety.image}.png`} alt={`Ilustración de ${product.name.toLowerCase()}`} width="1254" height="1254" fetchPriority={index === 0 ? "high" : "auto"} /></span>
        <span className="catalog-honey__identity">
          <HoneyLabel index={index} texture={variety.texture} name={index === 0 ? "Multifloral" : `De ${variety.image}`} />
          <span className="catalog-honey__price"><span className="catalog-honey__amount"><small>1 kg</small>{formatPrice(product.sizes[0].price)}</span><span className="catalog-honey__toggle" aria-hidden="true">{visible ? "−" : "+"}</span></span>
        </span>
      </button>
      <div id={panelId} className="catalog-honey__reveal" role="region" aria-label={`Acerca de ${product.name}`} inert={!visible} aria-hidden={!visible}>
        <div><p>{variety.description}</p><Link className="catalog-honey__link" href={`/productos/${product.slug}`}>Conocer esta miel <span aria-hidden="true">↗</span></Link></div>
      </div>
    </article>
  );
}

export default function HoneyCollection({ headingLevel = "h1" }) {
  const { products } = useCatalog();
  const titleId = useId();
  const Heading = headingLevel;
  return (
    <section className="honey-catalog" aria-labelledby={titleId}>
      <div className="container">
        <header className="honey-catalog__heading"><p className="eyebrow">De la colmena Puconina a tu mesa</p><Heading id={titleId}>Elige tu próxima favorita.</Heading><p>Tres mieles. Acércate y descubre la tuya.</p></header>
        <div className="honey-catalog__grid">{honeyVarieties.map((variety, index) => products.some(product => product.slug === variety.slug) && <Honey key={variety.slug} variety={variety} index={index} />)}</div>
        <p className="honey-catalog__note">Potes de 1 kg · Ilustraciones referenciales</p>
      </div>
    </section>
  );
}
