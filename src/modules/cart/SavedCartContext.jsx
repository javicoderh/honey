import { createContext,useCallback,useEffect,useRef,useState } from 'react';
import { useServices } from '../../services/ServicesContext';
import { useModuleContext } from '../../shared/useModuleContext';
import { useCart } from './CartContext';
import { browserCartStorage } from './storage.js';
import { newCartReference,readSavedCart,SAVED_CART_STORAGE_KEY } from './savedCart.js';

const SavedCartContext=createContext(null);
export function SavedCartProvider({children}) {
  const services=useServices();
  const cart=useCart();
  const [storage]=useState(browserCartStorage);
  const [reference,setReference]=useState(()=>readSavedCart(storage));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(null);
  const [message,setMessage]=useState(null);
  const current=useRef(reference);
  const last=useRef(null);
  const queue=useRef(Promise.resolve());
  const locked=useRef(false);
  const lineKey=JSON.stringify(cart.lines);
  const remember=useCallback(value=>{
    current.current=value; setReference(value);
    try { if(value)storage?.setItem(SAVED_CART_STORAGE_KEY,JSON.stringify(value)); else storage?.removeItem(SAVED_CART_STORAGE_KEY); } catch { /* El carrito local y la compra siguen disponibles. */ }
  },[storage]);
  const enqueueSync=useCallback((target,lines)=>{
    const key=JSON.stringify(lines);
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      if(current.current?.id!==target.id || last.current===`${target.id}:${key}`)return;
      try {
        await services.savedCart.sync({reference:target,lines});
        last.current=`${target.id}:${key}`;setError(null);
      } catch(cause) {
        if(current.current?.id!==target.id)return;
        if([404,409,410].includes(cause.status)){remember(null);setMessage('El guardado anterior terminó o venció. Puedes guardar una nueva selección.');}
        else setError('Tu carrito local se conserva. No pudimos actualizar la copia guardada; volveremos a intentarlo al cambiar la selección.');
      }
    });
    return queue.current;
  },[services,remember]);
  useEffect(()=>{
    if(services.mode!=='api' || !reference || !cart.ready)return;
    const timer=setTimeout(()=>enqueueSync(reference,JSON.parse(lineKey)),1200);
    return()=>clearTimeout(timer);
  },[services,reference,lineKey,cart.ready,enqueueSync]);
  const capture=async input=>{
    if(locked.current)return false;
    locked.current=true;setBusy(true);setError(null);setMessage(null);
    const target=current.current??newCartReference();
    const lines=cart.lines;
    try {
      await queue.current.catch(()=>{});
      const result=await services.savedCart.capture({...input,reference:target,lines});
      last.current=`${target.id}:${JSON.stringify(lines)}`;
      remember(target);
      setMessage(result.suppressed?'Este correo registra una baja. Tu selección está guardada, pero no se utilizará para enviar correos.':'Tu selección quedó guardada durante 30 días. Puedes volver a ella desde tu enlace privado.');
      return true;
    }catch(cause){setError(cause.message);return false;}
    finally{locked.current=false;setBusy(false);}
  };
  const recover=async target=>{
    if(locked.current)return false;
    locked.current=true;setBusy(true);setError(null);
    try {
      await queue.current.catch(()=>{});
      const result=await services.savedCart.recover(target);
      last.current=null;
      remember(target);cart.restoreSelection(result.lines);
      setMessage('Selección recuperada. Conservamos los productos que ya tenías y consultamos los precios actuales.');
      return true;
    }catch(cause){setError(cause.message);return false;}
    finally{locked.current=false;setBusy(false);}
  };
  const unsubscribe=async target=>{
    if(locked.current)return false;
    locked.current=true;setBusy(true);setError(null);
    try {
      await services.savedCart.unsubscribe(target);
      if(current.current?.id===target.id)remember(null);
      setMessage('Baja registrada. Este correo queda excluido de recordatorios, catálogos y promociones.');
      return true;
    }catch(cause){setError(cause.message);return false;}
    finally{locked.current=false;setBusy(false);}
  };
  const flush=async()=>{
    if(services.mode!=='api')return null;
    if(services.mode==='api' && current.current)await enqueueSync(current.current,cart.lines);
    return current.current;
  };
  return <SavedCartContext.Provider value={{enabled:services.mode==='api',reference,busy,error,message,capture,recover,unsubscribe,flush,markOrdered:()=>{remember(null);last.current=null;setMessage(null);}}}>{children}</SavedCartContext.Provider>;
}
export const useSavedCart=()=>useModuleContext(SavedCartContext,'SavedCart');
