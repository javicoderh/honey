import HoneyCollection from "../components/HoneyCollection";
import HoneyLabel from "../components/HoneyLabel";
import { Link } from "../components/Layout";
import "../styles/home-art.css";

export default function Home() {
  return (
    <>
      <section className="honey-dream" aria-labelledby="dream-title">
        <figure className="honey-dream__canvas">
          <img
            src="/art/jardin-de-miel.png"
            alt="Un jardín imaginario: abejas entre flores, islas flotantes y ríos de miel sobre un paisaje pintado de Chile."
            width="1536"
            height="1024"
            fetchPriority="high"
          />
          <figcaption>Jardín de miel <span>— una pequeña pausa para los sentidos</span></figcaption>
        </figure>
        <div className="container honey-dream__inner">
          <div className="honey-dream__copy">
            <p className="eyebrow">Casa Miel · De la colmena Puconina a tu mesa</p>
            <h1 id="dream-title">Hay un mundo<br />en cada <em>gota.</em></h1>
            <p className="honey-dream__description">Mieles chilenas para descubrir con calma.<br />Elige tu sabor, encuentra tu pequeño ritual.</p>
            <p className="honey-dream__note">Multifloral · Cerezo · Avellana</p>
          </div>
          <div className="honey-dream__collection" aria-label="Nuestras tres mieles">
            {[
              { id: "multifloral", name: "Multifloral", texture: "Dura" },
              { id: "cerezo", name: "De cerezo", texture: "Cremosa" },
              { id: "avellana", name: "De avellana", texture: "Cremosa" },
            ].map((honey, index) => (
              <a className={`honey-dream__honey honey-dream__honey--${honey.id}`} href="#elegir" key={honey.id}>
                <img src={`/art/miel-${honey.id}.png`} alt={`Ilustración referencial de miel ${honey.name.toLowerCase()}, textura ${honey.texture.toLowerCase()}`} width="1024" height="1024" />
                <HoneyLabel index={index} texture={honey.texture} name={honey.name} />
              </a>
            ))}
          </div>
        </div>
      </section>
      <div className="container honey-dream__actions">
        <Link className="button primary" href="/productos">Descubrir las mieles <span aria-hidden="true">↗</span></Link>
        <a className="honey-dream__guide" href="#elegir">Encuentra tu favorita <span aria-hidden="true">↓</span></a>
      </div>
      <HoneyCollection headingLevel="h2" />
      <section className="section warm" id="elegir">
        <div className="container two-columns"><div><p className="eyebrow">Una elección sencilla</p><h2>¿Qué textura te conquista?</h2><p className="lead">Tres variedades en potes de 1 kg para descubrir a tu ritmo.</p><p>Ilustraciones referenciales mientras preparamos las fotografías oficiales.</p></div><ol className="steps"><li><span>01</span><div><strong>Multifloral · Dura</strong><p>Una textura firme, expresión de distintas floraciones.</p><Link className="text-link" href="/productos/miel-multifloral">Conocer producto →</Link></div></li><li><span>02</span><div><strong>Cerezo · Cremosa</strong><p>Una textura suave para tus pequeños rituales.</p><Link className="text-link" href="/productos/miel-de-cerezo">Conocer producto →</Link></div></li><li><span>03</span><div><strong>Avellana · Cremosa</strong><p>Disponible en pote de 1 kg.</p><Link className="text-link" href="/productos/miel-de-avellana">Conocer producto →</Link></div></li></ol></div>
      </section>
    </>
  );
}
