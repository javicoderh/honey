import { useState } from 'react';
import StaffShell from '../staff/StaffShell';
import { ActionButton,ConfirmDialog,DetailPanel,FilterBar,StateMessage } from '../../shared/ui';
import { useMarketing } from './MarketingContext';
import { CART_STATUS_LABELS } from './model.js';
import { formatPrice } from '../../data/products';
import { orderDate } from '../orders/presentation';
import '../../styles/marketing.css';

export default function MarketingPage() {
  const marketing=useMarketing();
  const [pending,setPending]=useState(null);
  const [copyMessage,setCopyMessage]=useState(null);
  const carts=marketing.kind==='carts';
  const choices=carts?[['all','Todos'],['abandoned','Abandonados'],['active','Activos'],['ordered','Con pedido'],['converted','Pagados'],['unsubscribed','Con baja'],['expired','Vencidos']]
    :[['all','Todos'],['campaigns','Catálogos / promociones'],['repeat','Recompra'],['unsubscribed','Con baja']];
  return <StaffShell title="Marketing" description="Carritos guardados y contactos con sus preferencias de correo." back="/staff/admin">
    {!marketing.enabled?<StateMessage title="Disponible con la base de datos conectada">Este módulo conserva consentimientos y bajas en el servidor.</StateMessage>:<>
      <DetailPanel title="Elige qué revisar"><div className="commerce-actions">
        <ActionButton variant={carts?'primary':'secondary'} onClick={()=>marketing.filter({kind:'carts',segment:'all',offset:0,query:''})}>Carritos guardados</ActionButton>
        <ActionButton variant={marketing.kind==='contacts'?'primary':'secondary'} onClick={()=>marketing.filter({kind:'contacts',segment:'all',offset:0,query:''})}>Contactos y recompra</ActionButton>
      </div><p>Un carrito se considera abandonado después de una hora sin cambios. Los enlaces vencen a los 30 días. Crear un pedido lo retira de la recuperación de carritos.</p><p>Este módulo prepara listas y enlaces; todavía no envía correos.</p></DetailPanel>
      {marketing.kind && <>
        <FilterBar label="Buscar por nombre o correo" query={marketing.query} onQueryChange={value=>marketing.filter({query:value.slice(0,100),offset:0})}>
          <div className="commerce-actions">{choices.map(([value,label])=><ActionButton key={value} variant={marketing.segment===value?'primary':'secondary'} aria-pressed={marketing.segment===value} onClick={()=>marketing.filter({segment:value,offset:0})}>{label}</ActionButton>)}</div>
        </FilterBar>
        <div className="commerce-actions marketing-toolbar"><ActionButton variant="secondary" disabled={marketing.busy} onClick={marketing.refresh}>Actualizar</ActionButton>
          {carts?<ActionButton disabled={marketing.busy} onClick={()=>marketing.exportCsv('recovery')}>Exportar carritos abandonados</ActionButton>:<><ActionButton disabled={marketing.busy} onClick={()=>marketing.exportCsv('campaigns')}>Exportar catálogo / promociones</ActionButton><ActionButton variant="secondary" disabled={marketing.busy} onClick={()=>marketing.exportCsv('repeat')}>Exportar recompra</ActionButton></>}
        </div>
        <p>Las exportaciones incluyen el segmento completo hasta 5.000 registros, aunque la búsqueda de pantalla sea distinta. Solo incluyen los permisos correspondientes y excluyen las bajas. Recompra requiere al menos una compra pagada y excluye pedidos ficticios.</p>
        {marketing.message && <StateMessage title={marketing.message} />}{marketing.actionError && <StateMessage kind="error" title={marketing.actionError} />}{copyMessage && <StateMessage title={copyMessage} />}
        {marketing.status==='error'?<StateMessage kind="error" title="No pudimos consultar Marketing">{marketing.error?.message}</StateMessage>:marketing.status!=='ready'?<StateMessage title="Consultando registros…" />:!marketing.rows.length?<StateMessage title="No hay registros para este filtro">Los visitantes aparecerán después de guardar voluntariamente su carrito.</StateMessage>:<>
          <p>{marketing.total} registros · mostrando {marketing.offset+1}–{Math.min(marketing.offset+50,marketing.total)}</p>
          <div className="marketing-table-wrap"><table className="marketing-table"><thead><tr><th scope="col">Contacto</th><th scope="col">{carts?'Carrito':'Preferencias'}</th><th scope="col">{carts?'Actividad':'Compras'}</th><th scope="col">Acciones</th></tr></thead><tbody>
            {marketing.rows.map(row=><tr key={row.id}><td><strong>{row.name||'Sin nombre'}</strong><span>{row.email}</span></td><td>{carts?<><strong>{CART_STATUS_LABELS[row.status]}</strong><span>{formatPrice(row.subtotal)} en productos</span><ul>{row.items.map((item,index)=><li key={index}>{item.name} · {item.format} × {item.quantity}</li>)}</ul><span>Recuperación autorizada: {orderDate(row.recoveryConsentAt)}</span></>:<><strong>{row.suppressedAt?'Baja de correos':row.marketingConsentAt?'Catálogos y promociones autorizados':'Solo recuperación de carrito'}</strong><span>{row.marketingConsentAt?orderDate(row.marketingConsentAt):'Sin permiso para campañas generales'}</span></>}</td>
              <td>{carts?<><span>{orderDate(row.updatedAt)}</span><span>Vence: {orderDate(row.expiresAt)}</span>{row.recoveredAt && <span>Recuperado: {orderDate(row.recoveredAt)}</span>}</>:<><span>{row.paidOrders} compras pagadas</span><span>{formatPrice(Number(row.lifetimeTotal))}</span><span>Última: {orderDate(row.lastPurchaseAt)}</span></>}</td>
              <td><div className="marketing-actions">{carts && row.recoveryUrl && <ActionButton variant="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(row.recoveryUrl);setCopyMessage('Enlace privado de recuperación copiado.');}catch{setCopyMessage('No pudimos copiar el enlace. Revisa el permiso del portapapeles.');}}}>Copiar recuperación</ActionButton>}
                {!row.suppressedAt && <ActionButton variant="secondary" disabled={marketing.busy} onClick={()=>setPending({id:row.contactId??row.id,email:row.email})}>Dar de baja</ActionButton>}
              </div></td></tr>)}
          </tbody></table></div>
          <div className="commerce-actions"><ActionButton variant="secondary" disabled={marketing.offset===0 || marketing.busy} onClick={()=>marketing.filter({offset:Math.max(0,marketing.offset-50)})}>Anterior</ActionButton><ActionButton variant="secondary" disabled={marketing.offset+50>=marketing.total || marketing.busy} onClick={()=>marketing.filter({offset:marketing.offset+50})}>Siguiente</ActionButton></div>
        </>}
      </>}
      <ConfirmDialog open={Boolean(pending)} title="Confirmar baja de correos" confirmLabel="Registrar baja" busy={marketing.busy} onClose={()=>setPending(null)} onConfirm={async()=>{if(await marketing.unsubscribe(pending.id))setPending(null);}}><p>{pending?.email} quedará excluido de recordatorios, catálogos y promociones. Se conserva el registro de su decisión.</p></ConfirmDialog>
    </>}
  </StaffShell>;
}
