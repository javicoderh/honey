const WHATSAPP_URL = 'https://wa.me/56973930516';

export default function WhatsAppLink({ children = 'Encargar al WhatsApp', product, format, quantity = 1, className = '' }) {
  const message = product ? `Hola, quiero encargar ${quantity} ${quantity === 1 ? 'unidad' : 'unidades'} de ${product.name}, formato ${format}. ¿Podemos coordinar el pedido y la entrega?` : '';
  const href = message ? `${WHATSAPP_URL}?text=${encodeURIComponent(message)}` : WHATSAPP_URL;
  return <a className={`whatsapp-link ${className}`} href={href} target="_blank" rel="noopener noreferrer">
    <span>{children}</span>
    <svg className="whatsapp-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.47 0 .11 5.35.1 11.93c0 2.1.55 4.15 1.6 5.96L0 24l6.28-1.65a11.94 11.94 0 0 0 5.76 1.47h.01C18.63 23.82 24 18.47 24 11.89c0-3.18-1.24-6.17-3.48-8.41ZM12.05 21.8a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.73.98 1-3.64-.24-.38a9.88 9.88 0 0 1-1.51-5.24c0-5.47 4.45-9.92 9.93-9.92 2.65 0 5.14 1.03 7.01 2.91a9.85 9.85 0 0 1 2.9 7.01c0 5.47-4.45 9.92-9.96 9.92Zm5.44-7.43c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37s-1.04 1.02-1.04 2.48 1.07 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.58-.35Z" /></svg>
  </a>;
}
