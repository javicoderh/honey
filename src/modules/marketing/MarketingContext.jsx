import { createContext,useCallback,useState } from 'react';
import { useServices } from '../../services/ServicesContext';
import { useModuleContext } from '../../shared/useModuleContext';
import { useResource } from '../../shared/useResource';
import { useSession } from '../staff/SessionContext';

const MarketingContext=createContext(null);
export function MarketingProvider({children}) {
  const services=useServices();
  const {session,views,updateView}=useSession();
  const {kind=null,segment='all',query='',offset=0}=views.Marketing??{};
  const enabled=services.mode==='api';
  const load=useCallback(()=>services.marketing.list({kind,segment,query,offset:String(offset)}),[services,kind,segment,query,offset]);
  const resource=useResource(load,{rows:[],total:0},enabled && session?.role==='admin' && Boolean(kind));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(null);
  const [message,setMessage]=useState(null);
  const filter=changes=>updateView('Marketing',{kind,segment,query,offset,...changes});
  const exportCsv=async selected=>{
    if(busy)return;setBusy(true);setError(null);setMessage(null);
    try{
      const result=await services.marketing.export(selected);
      const link=document.createElement('a');const url=URL.createObjectURL(new Blob([result.csv],{type:'text/csv;charset=utf-8'}));
      try{link.href=url;link.download=result.filename;document.body.appendChild(link);link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
      setMessage(`Exportación preparada: ${result.count} registros autorizados. Las bajas y carritos con pedido se excluyen según el segmento.`);
    }catch(cause){setError(cause.message);}finally{setBusy(false);}
  };
  const unsubscribe=async contactId=>{
    if(busy)return false;setBusy(true);setError(null);
    try{await services.marketing.unsubscribe(contactId);resource.refresh();setMessage('Baja registrada. El contacto queda excluido de futuras exportaciones de campañas.');return true;}
    catch(cause){setError(cause.message);return false;}finally{setBusy(false);}
  };
  return <MarketingContext.Provider value={{enabled,kind,segment,query,offset,filter,...resource,rows:resource.data?.rows??[],total:resource.data?.total??0,busy,actionError:error,message,exportCsv,unsubscribe}}>{children}</MarketingContext.Provider>;
}
export const useMarketing=()=>useModuleContext(MarketingContext,'Marketing');
