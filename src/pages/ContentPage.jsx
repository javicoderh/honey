import { Link } from "../components/Layout";
import WhatsAppLink from "../components/WhatsAppLink";

export function About() {
  return <><header className="page-header container narrow"><p className="eyebrow">Nuestro origen</p><h1>La historia se completará con evidencia real.</h1><p className="lead">Esta ruta está preparada para documentar territorio, productores, floraciones y prácticas de trabajo.</p></header><section className="section warm"><div className="container three-columns"><article><span>01</span><h2>Territorio</h2><p>Región, paisaje y floraciones.</p></article><article><span>02</span><h2>Personas</h2><p>Apicultores y experiencia.</p></article><article><span>03</span><h2>Proceso</h2><p>Cosecha, envasado y trazabilidad.</p></article></div></section></>;
}

export function Contact() {
  return <header className="page-header container narrow"><p className="eyebrow">Hablemos</p><h1>Contacto y preguntas frecuentes.</h1><p className="lead">Escríbenos por WhatsApp para resolver tus dudas.</p><WhatsAppLink className="button primary">Hablemos por WhatsApp</WhatsAppLink></header>;
}

export function NotFound() {
  return <section className="empty-state container"><p className="eyebrow">404</p><h1>Esta página no está en la colmena.</h1><Link className="button primary" href="/">Volver al inicio</Link></section>;
}
