import { useEffect,useState } from 'react';
import { ActionButton,ConfirmDialog,DetailPanel,FormField,StateMessage } from '../../shared/ui';
import { isValidEmail } from '../../shared/validation.js';
import { useCart } from './CartContext';
import { useSavedCart } from './SavedCartContext';
import { parseCartLink } from './savedCart.js';

export function SavedCartLink() {
  const saved=useSavedCart();
  const [link,setLink]=useState(()=>parseCartLink(typeof window==='undefined'?'':window.location.hash));
  const [finished,setFinished]=useState(false);
  useEffect(()=>{const update=()=>{setLink(parseCartLink(window.location.hash));setFinished(false);};window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
  if(!saved.enabled || !link)return null;
  const unsubscribe=link.action==='baja';
  return <DetailPanel title={unsubscribe?'Preferencias de correo':'Recupera tu selección'}>
    <p>{unsubscribe?'Confirma la baja para dejar de recibir recordatorios, catálogos y promociones.':'Recupera los productos de tu carrito guardado. Conservaremos los que ya tengas y usaremos los precios vigentes.'}</p>
    {!finished && <ActionButton disabled={saved.busy} onClick={async()=>{
      const ok=await (unsubscribe?saved.unsubscribe(link.reference):saved.recover(link.reference));
      if(ok){setFinished(true);window.history.replaceState({},'',window.location.pathname);}
    }}>{saved.busy?'Procesando…':unsubscribe?'Confirmar baja de correos':'Recuperar selección'}</ActionButton>}
    {saved.error && <StateMessage kind="error" title={saved.error} />}
    {saved.message && <StateMessage title={saved.message} />}
  </DetailPanel>;
}

export default function SavedCartPanel({email:initialEmail='',name:initialName='',source='cart'}) {
  const saved=useSavedCart();
  const cart=useCart();
  const [email,setEmail]=useState(null);
  const [name,setName]=useState(null);
  const [recoveryConsent,setRecoveryConsent]=useState(false);
  const [marketingConsent,setMarketingConsent]=useState(false);
  const [errors,setErrors]=useState({});
  const [confirm,setConfirm]=useState(false);
  const [copied,setCopied]=useState(false);
  if(!saved.enabled || !cart.lines.length)return null;
  const value=email??initialEmail;
  return <DetailPanel title={saved.reference?'Tu carrito está guardado':'¿Prefieres comprar después?'}>
    {saved.reference?<><p>Tu selección se actualiza mientras cambias productos. Puedes recuperarla desde este navegador o guardar tu enlace privado para usarlo en otro dispositivo.</p>
      <div className="commerce-actions"><ActionButton variant="secondary" onClick={async()=>{
        try{await navigator.clipboard.writeText(`${window.location.origin}/carrito#recuperar=${saved.reference.id}.${saved.reference.token}`);setCopied(true);}catch{setCopied(false);setErrors({copy:'No pudimos copiar el enlace. Habilita el portapapeles del navegador e inténtalo nuevamente.'});}
      }}>{copied?'Enlace copiado':'Copiar enlace privado'}</ActionButton><ActionButton variant="secondary" disabled={saved.busy} onClick={()=>setConfirm(true)}>Dejar de recibir correos</ActionButton></div>
    </>:<form className="saved-cart-form" onSubmit={async event=>{
      event.preventDefault();const found={};if(!isValidEmail(value))found.email='Ingresa un correo válido.';if(!recoveryConsent)found.consent='Autoriza el recordatorio para guardar esta selección.';
      setErrors(found);if(Object.keys(found).length)return;
      await saved.capture({email:value,name:name??initialName,recoveryConsent,marketingConsent,source});
    }} noValidate><p>Guarda tu selección durante 30 días. Elige por separado qué correos quieres recibir; no necesitas crear una cuenta.</p>
      <FormField label="Tu correo para recuperar el carrito" name="savedCart.email" type="email" autoComplete="email" maxLength={254} required value={value} onChange={event=>setEmail(event.target.value)} error={errors.email} />
      <FormField label="Tu nombre (opcional)" name="savedCart.name" maxLength={100} autoComplete="name" value={name??initialName} onChange={event=>setName(event.target.value)} />
      <label className="checkout-checkbox"><input name="savedCart.recoveryConsent" type="checkbox" checked={recoveryConsent} onChange={event=>setRecoveryConsent(event.target.checked)} />Quiero guardar este carrito y recibir un recordatorio para retomarlo.</label>
      <label className="checkout-checkbox"><input name="savedCart.marketingConsent" type="checkbox" checked={marketingConsent} onChange={event=>setMarketingConsent(event.target.checked)} />También quiero recibir catálogos, novedades y promociones de Casa Miel (opcional).</label>
      <p className="saved-cart-hint">Puedes darte de baja en cualquier momento. Los envíos por correo todavía no están activados.</p>
      {errors.consent && <StateMessage kind="error" title={errors.consent} />}
      <ActionButton type="submit" disabled={saved.busy || !cart.canCheckout}>{saved.busy?'Guardando…':'Guardar para después'}</ActionButton>
    </form>}
    {errors.copy && <StateMessage kind="error" title={errors.copy} />}
    {saved.error && <StateMessage kind="error" title={saved.error} />}
    {saved.message && <StateMessage title={saved.message} />}
    <ConfirmDialog open={confirm} title="¿Dejar de recibir correos?" confirmLabel="Confirmar baja" busy={saved.busy} onClose={()=>setConfirm(false)} onConfirm={async()=>{if(await saved.unsubscribe(saved.reference))setConfirm(false);}}><p>El correo asociado quedará excluido de recordatorios, catálogos y promociones. Tu carrito local se conserva.</p></ConfirmDialog>
  </DetailPanel>;
}
