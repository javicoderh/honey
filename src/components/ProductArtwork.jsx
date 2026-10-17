const artwork = {
  "miel-multifloral": "/art/miel-multifloral.png",
  "miel-de-cerezo": "/art/miel-cerezo.png",
  "miel-de-avellana": "/art/miel-avellana.png",
};

export default function ProductArtwork({ product, className = "" }) {
  if (artwork[product.slug]) return <img className={`product-artwork ${className}`} src={artwork[product.slug]} alt={`Ilustración de ${product.name.toLowerCase()}`} width="1254" height="1254" />;
  return <span className={`product-artwork product-artwork--placeholder ${className}`} aria-hidden="true">{product.name}</span>;
}
