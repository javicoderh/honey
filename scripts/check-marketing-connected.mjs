import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID,randomBytes } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import handler from '../api/index.js';

// Solo modifica registros creados por esta ejecución. No envía correos ni llama al proveedor de pago.
const credentials=JSON.parse(await readFile(new URL('../.vercel/admin-credentials.local.json',import.meta.url),'utf8'));
const report={scope:'http-supabase-marketing',checks:[],startedAt:new Date().toISOString()};
const marker=`marketing-smoke-${randomUUID()}`;
const email=`${marker}@example.com`;
const email2=`${marker}-other@example.com`;
const references=[1,2,3].map(()=>({id:randomUUID(),token:randomBytes(32).toString('hex')}));
const dbOrigin=process.env.SUPABASE_URL;
const secret=process.env.SUPABASE_SECRET_KEY;
const dbHeaders={apikey:secret,...(secret?.startsWith('eyJ')?{Authorization:`Bearer ${secret}`}:{ }),'Content-Type':'application/json'};
const privateRequest=async(path,method='GET',body)=>{
  const response=await fetch(`${dbOrigin}/rest/v1/${path}`,{method,headers:dbHeaders,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  assert.ok(response.ok,`Error privado de preparación/limpieza (${response.status})`);
  return response.status===204?null:response.json();
};
const server=createServer(handler);await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;
process.env.APP_ORIGIN=origin;process.env.SHIPPING_COMMUNES='Prueba técnica';
let cookie;let orderId;let orderArchived=false;
const call=async(route,{body,query,authenticated=false,expected=200}={})=>{
  const response=await fetch(`${origin}/api?${new URLSearchParams({route,...query})}`,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...(authenticated?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(25000)});
  assert.equal(response.status,expected,`Código HTTP inesperado en ${route}`);
  const session=response.headers.get('set-cookie');if(session)cookie=session.split(';')[0];
  const data=await response.json();report.checks.push({route,status:response.status});console.log(`${response.status} ${route}`);return data;
};
const payload=(reference,targetEmail,promotions=false)=>({reference,email:targetEmail,name:'PRUEBA TÉCNICA MARKETING',recoveryConsent:true,marketingConsent:promotions,source:'cart',lines:[{slug:'miel-multifloral',format:'1 kg',quantity:1}],subtotal:1});
try{
  await call('carts/capture',{body:{...payload(references[0],email),recoveryConsent:false},expected:422});
  await call('carts/capture',{body:payload(references[0],email)});
  await call('carts/capture',{body:payload(references[0],email)});
  await call('carts/capture',{body:payload(references[1],email,true)});
  await call('carts/capture',{body:payload(references[2],email2)});
  await call('carts/recover',{body:{reference:{...references[0],token:'f'.repeat(64)}},expected:404});
  await call('carts/touch',{body:{reference:references[0],lines:[{slug:'miel-multifloral',format:'1 kg',quantity:2}],subtotal:1}});
  await call('login',{body:{email:credentials.email,password:credentials.password}});
  const contactList=await call('marketing/list',{authenticated:true,query:{kind:'contacts',segment:'all',query:marker}});
  assert.equal(contactList.total,2,'Dos carritos con el mismo correo deben compartir contacto.');
  const cartList=await call('marketing/list',{authenticated:true,query:{kind:'carts',segment:'all',query:marker}});
  assert.equal(cartList.total,3);assert.equal(cartList.rows.find(row=>row.id===references[0].id).subtotal,13980);
  const before=await call('marketing/export',{authenticated:true,query:{segment:'recovery'}});
  assert.ok(!before.csv.includes(email),'Un carrito activo no es abandonado.');
  for(const ref of references.slice(0,2))await privateRequest(`honey_saved_carts?id=eq.${ref.id}`,'PATCH',{updated_at:new Date(Date.now()-2*3600000).toISOString()});
  const abandoned=await call('marketing/list',{authenticated:true,query:{kind:'carts',segment:'abandoned',query:marker}});
  assert.equal(abandoned.total,2);
  const recovery=await call('marketing/export',{authenticated:true,query:{segment:'recovery'}});
  assert.ok(recovery.csv.includes(email));assert.ok(!recovery.csv.includes(email2));
  const promotions=await call('marketing/export',{authenticated:true,query:{segment:'campaigns'}});
  assert.ok(promotions.csv.includes(email));assert.ok(!promotions.csv.includes(email2));
  const link=new URL(abandoned.rows.find(row=>row.id===references[0].id).recoveryUrl);
  const [cartId,token]=link.hash.slice('#recuperar='.length).split('.');
  assert.notEqual(token,references[0].token,'El enlace admin usa una capacidad separada.');
  const recovered=await call('carts/recover',{body:{reference:{id:cartId,token}}});
  assert.equal(recovered.lines[0].quantity,2);assert.equal(Object.hasOwn(recovered,'email'),false);
  await privateRequest(`honey_saved_carts?id=eq.${references[2].id}`,'PATCH',{expires_at:'2000-01-01T00:00:00.000Z'});
  await call('carts/recover',{body:{reference:references[2]},expected:410});
  await call('carts/unsubscribe',{body:{reference:references[2]}});
  await call('carts/unsubscribe',{body:{reference:references[0]}});
  const suppressed=await call('marketing/export',{authenticated:true,query:{segment:'campaigns'}});
  assert.ok(!suppressed.csv.includes(email));
  await call('carts/capture',{body:payload(references[1],email,true)});
  const stillSuppressed=await call('marketing/export',{authenticated:true,query:{segment:'campaigns'}});
  assert.ok(!stillSuppressed.csv.includes(email),'Una captura nueva no revoca la baja anterior.');
  const draft={buyer:{name:'PRUEBA TÉCNICA MARKETING',email,phone:'+56900000000'},recipientSameAsBuyer:true,shippingAddress:{street:'Dirección de prueba 123',commune:'Prueba técnica'},deliveryInstructions:'PRUEBA TÉCNICA: NO COBRAR NI DESPACHAR.'};
  const purchaseInput={requestId:randomUUID(),draft,items:[{slug:'miel-multifloral',format:'1 kg',quantity:1}],savedCart:references[1]};
  const order=await call('orders/create',{body:purchaseInput});orderId=order.order.id;
  const retry=await call('orders/create',{body:purchaseInput});assert.equal(retry.order.id,orderId);
  await call('carts/recover',{body:{reference:references[1]},expected:409});
  const linked=await call('marketing/list',{authenticated:true,query:{kind:'carts',segment:'ordered',query:marker}});
  assert.equal(linked.total,1);assert.equal(linked.rows[0].orderId,orderId);
  const finalRecovery=await call('marketing/export',{authenticated:true,query:{segment:'recovery'}});
  assert.ok(!finalRecovery.csv.includes(email));
  for(const type of ['cancel','archive'])await call('orders/update',{authenticated:true,body:{id:orderId,command:{type,payload:{reason:'Cierre de prueba técnica de carritos abandonados.'}}}});
  orderArchived=true;report.passed=true;
}catch(error){console.error(error.message);report.passed=false;report.error=error.message;process.exitCode=1;}
finally{
  try{
    if(orderId && !orderArchived && cookie)for(const type of ['cancel','archive'])await call('orders/update',{authenticated:true,body:{id:orderId,command:{type,payload:{reason:'Cierre de prueba técnica interrumpida.'}}}});
    for(const targetEmail of [email,email2]){
      const contacts=await privateRequest(`honey_marketing_contacts?email=eq.${encodeURIComponent(targetEmail)}&select=id`);
      for(const contact of contacts){
        await privateRequest(`honey_consent_events?contact_id=eq.${contact.id}`,'DELETE');
        await privateRequest(`honey_saved_carts?contact_id=eq.${contact.id}`,'DELETE');
        await privateRequest(`honey_marketing_contacts?id=eq.${contact.id}`,'DELETE');
      }
    }
    if(cookie)await call('logout',{authenticated:true,body:{}});
    report.cleanup=true;
  }catch(error){console.error('Revisar limpieza de datos técnicos.');report.cleanup=false;process.exitCode=1;}
  server.close();report.finishedAt=new Date().toISOString();await mkdir(new URL('../.preview-browser/',import.meta.url),{recursive:true});
  await writeFile(new URL('../.preview-browser/marketing-connected-report.json',import.meta.url),JSON.stringify(report,null,2));
  console.log(`${report.checks.length} comprobaciones; resultado ${report.passed?'correcto':'fallido'}; contactos de prueba retirados: ${report.cleanup}.`);
}
