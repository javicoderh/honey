import { createHash, createHmac } from 'node:crypto';
import { insist, HttpError } from './errors.mjs';
import { sanitizeCart } from '../src/modules/cart/model.js';
import { snapshotItems } from '../src/modules/orders/model.js';
import { isValidEmail } from '../src/shared/validation.js';
import { campaignCsv } from '../src/modules/marketing/model.js';

const digest = token => createHash('sha256').update(token).digest('hex');
const uuid = value => typeof value === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value);
export function cartReference(value) {
  insist(uuid(value?.id) && typeof value.token === 'string' && /^[a-f\d]{64}$/.test(value.token),404,'El enlace del carrito no está disponible.');
  return { p_id: value.id, p_hash: digest(value.token) };
}
const recoveryToken = (id, config) => createHmac('sha256',config.orderSecret).update(`saved-cart:${id}`).digest('hex');
const links = (row, config) => {
  const id = row.contactId ? row.id : row.unsubscribeCartId;
  if (!id) return { ...row, unsubscribeUrl: null };
  const reference = `${id}.${recoveryToken(id,config)}`;
  return { ...row, ...(row.contactId ? { recoveryUrl: ['active','abandoned'].includes(row.status) && !row.suppressedAt ? `${config.origin}/carrito#recuperar=${reference}` : null } : {}), unsubscribeUrl: `${config.origin}/carrito#baja=${reference}` };
};
async function snapshot(lines, db, allowEmpty=false) {
  const clean = sanitizeCart(lines);
  insist(clean.length<=30 && (allowEmpty || clean.length>0),422,'Agrega productos antes de guardar el carrito.');
  const items = clean.length ? snapshotItems(clean,await db.catalog()) : [];
  const subtotal=items.reduce((sum,item)=>sum+item.lineTotal,0);
  insist(Number.isSafeInteger(subtotal),422,'El importe del carrito no es válido.');
  return { p_lines: clean,p_items:items,p_subtotal:subtotal };
}
export async function marketingRequest({ route,method,body,url,db,config,sessionHash,requireRole,rate }) {
  if (route.startsWith('carts/')) {
    insist(method==='POST',405,'Método no permitido.');
    const reference=cartReference(body.reference);
    await rate(route==='carts/touch' ? 'cart-sync' : 'cart-contact',route==='carts/touch' ? 240 : 60);
    if (route==='carts/capture') {
      insist(isValidEmail(body.email) && body.recoveryConsent===true && typeof body.marketingConsent==='boolean',422,'Ingresa un correo válido y autoriza el recordatorio de este carrito.');
      insist(typeof body.name==='string' && body.name.trim().length<=100 && ['cart','checkout'].includes(body.source),422,'Revisa nombre y origen del formulario.');
      return db.rpc('capture_cart',{...reference,p_recovery_hash:digest(recoveryToken(body.reference.id,config)),p_email:body.email.trim().toLowerCase(),p_name:body.name.trim(),...await snapshot(body.lines,db),p_marketing:body.marketingConsent,p_source:body.source});
    }
    if(route==='carts/touch') return db.rpc('touch_cart',{...reference,...await snapshot(body.lines,db,true)});
    if(route==='carts/recover') return db.rpc('recover_cart',reference);
    if(route==='carts/unsubscribe') return db.rpc('unsubscribe_cart',reference);
    throw new HttpError(404,'Operación no encontrada.');
  }
  requireRole('admin');
  if(route==='marketing/unsubscribe' && method==='POST') {
    insist(uuid(body.contactId),422,'Contacto no válido.');
    return db.rpc('marketing_unsubscribe',{p_hash:sessionHash,p_contact_id:body.contactId});
  }
  insist(method==='GET',405,'Método no permitido.');
  if(route==='marketing/export') {
    const segment=url.searchParams.get('segment');
    insist(['recovery','campaigns','repeat'].includes(segment),422,'Elige un segmento autorizado.');
    const data=await db.rpc('marketing_list',{p_hash:sessionHash,p_kind:segment==='recovery'?'carts':'contacts',p_segment:segment,p_query:'',p_offset:0,p_limit:5001});
    insist(data.total<=5000,422,'El segmento supera 5.000 registros; prepara la exportación por lotes antes de continuar.');
    const seen=new Set();
    const rows=data.rows.filter(row=>{if(seen.has(row.email))return false;seen.add(row.email);return true;}).map(row=>links(row,config));
    return { count:rows.length,filename:`casa-miel-${segment}.csv`,csv:campaignCsv(rows,segment) };
  }
  if(route==='marketing/list') {
    const kind=url.searchParams.get('kind')??'carts';
    const segment=url.searchParams.get('segment')??'all';
    const query=url.searchParams.get('query')??'';
    const offset=Number(url.searchParams.get('offset')??0);
    insist(['carts','contacts'].includes(kind) && (kind==='carts'?['all','active','abandoned','ordered','converted','unsubscribed','expired','cleared']:['all','campaigns','repeat','unsubscribed']).includes(segment),422,'Filtro no válido.');
    insist(query.length<=100 && Number.isSafeInteger(offset) && offset>=0 && offset<=100000,422,'Búsqueda no válida.');
    const data=await db.rpc('marketing_list',{p_hash:sessionHash,p_kind:kind,p_segment:segment,p_query:query,p_offset:offset,p_limit:50});
    return {...data,rows:data.rows.map(row=>links(row,config))};
  }
  throw new HttpError(404,'Operación no encontrada.');
}
