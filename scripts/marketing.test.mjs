import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { setup,draft } from './fixtures/backend-store.mjs';
import { cartReducer } from '../src/modules/cart/model.js';
import { readSavedCart,parseCartLink } from '../src/modules/cart/savedCart.js';
import { campaignCsv } from '../src/modules/marketing/model.js';
import { createHttpAdapter } from '../src/services/http.js';

const reference=()=>({id:randomUUID(),token:'a'.repeat(64)});
const capture=()=>({reference:reference(),email:'Guest@Example.com',name:'Invitada',recoveryConsent:true,marketingConsent:false,source:'cart',lines:[{slug:'miel-multifloral',format:'1 kg',quantity:2}],subtotal:1});

test('captura exige consentimiento explícito, referencia válida y precios calculados en servidor',async()=>{
  const f=setup();const input=capture();const calls=[];
  const original=f.db.rpc;
  f.db.rpc=async(name,args)=>name==='capture_cart'?(calls.push(args),{id:args.p_id}):original(name,args);
  assert.equal((await f.call('carts/capture',{method:'POST',body:{...input,recoveryConsent:false}})).status,422);
  assert.equal((await f.call('carts/capture',{method:'POST',body:{...input,marketingConsent:'true'}})).status,422);
  assert.equal((await f.call('carts/capture',{method:'POST',body:{...input,reference:{id:input.reference.id,token:'x'}}})).status,404);
  assert.equal(calls.length,0);
  assert.equal((await f.call('carts/capture',{method:'POST',body:input})).status,200);
  assert.equal(calls[0].p_subtotal,13980);
  assert.equal(calls[0].p_email,'guest@example.com');
  assert.equal(calls[0].p_marketing,false);
  assert.equal(calls[0].p_hash,createHash('sha256').update(input.reference.token).digest('hex'));
  assert.notEqual(calls[0].p_recovery_hash,input.reference.token);
  assert.equal((await f.call('carts/capture',{method:'POST',body:input,headers:{Origin:'https://foreign.example'}})).status,403);
});

test('sincronización acepta vaciado y descarta importes y permisos enviados por cliente',async()=>{
  const f=setup();let args;const original=f.db.rpc;
  f.db.rpc=async(name,input)=>name==='touch_cart'?(args=input,{saved:true}):original(name,input);
  assert.equal((await f.call('carts/touch',{method:'POST',body:{reference:reference(),lines:[],email:'other@example.com',marketingConsent:true,subtotal:99999}})).status,200);
  assert.equal(args.p_subtotal,0);assert.deepEqual(args.p_items,[]);
  assert.equal(Object.hasOwn(args,'email'),false);assert.equal(Object.hasOwn(args,'p_marketing'),false);
  assert.equal((await f.call('carts/touch',{method:'POST',body:{reference:reference(),lines:[{slug:'miel-multifloral',format:'1 kg',quantity:100}]}})).status,422);
});

test('Marketing y sus exportaciones requieren admin; delivery no ve contactos',async()=>{
  const f=setup();const admin=(await f.login()).headers.get('set-cookie');
  const delivery=(await f.login('delivery@example.cl')).headers.get('set-cookie');
  for(const route of ['marketing/list','route=marketing%2Fexport&segment=campaigns']){
    assert.equal((await f.call(route)).status,401);
    assert.equal((await f.call(route,{cookie:delivery})).status,403);
  }
  let query;const original=f.db.rpc;
  f.db.rpc=async(name,args)=>name==='marketing_list'?(query=args,{rows:[],total:0}):original(name,args);
  assert.equal((await f.call('route=marketing%2Flist&kind=contacts&segment=repeat',{cookie:admin})).status,200);
  assert.equal(query.p_segment,'repeat');assert.equal(query.p_kind,'contacts');assert.match(query.p_hash,/^[a-f\d]{64}$/);
  assert.equal((await f.call('route=marketing%2Flist&offset=-1',{cookie:admin})).status,422);
});

test('exportación consulta segmentos vigentes, agrega enlaces privados y limita tamaño',async()=>{
  const f=setup();const admin=(await f.login()).headers.get('set-cookie');const cartId=randomUUID();
  const original=f.db.rpc;let requested;
  f.db.rpc=async(name,args)=>name==='marketing_list'?(requested=args,{total:1,rows:[{id:cartId,contactId:randomUUID(),email:'guest@example.com',name:'=HYPERLINK("fake")',status:'abandoned',items:[{name:'Miel',format:'1 kg',quantity:1}],subtotal:6990}]}):original(name,args);
  const result=await f.call('route=marketing%2Fexport&segment=recovery',{cookie:admin});
  assert.equal(result.status,200);assert.equal(requested.p_segment,'recovery');
  assert.ok(result.data.csv.includes(`https://honey.example/carrito#recuperar=${cartId}.`));
  assert.ok(result.data.csv.includes("'=HYPERLINK"));
  f.db.rpc=async(name,args)=>name==='marketing_list'?{total:2,rows:[{id:cartId,contactId:randomUUID(),email:'guest@example.com',items:[],status:'abandoned'},{id:randomUUID(),contactId:randomUUID(),email:'guest@example.com',items:[],status:'abandoned'}]}:original(name,args);
  assert.equal((await f.call('route=marketing%2Fexport&segment=recovery',{cookie:admin})).data.count,1,'Se exporta un único recordatorio por correo.');
  assert.equal((await f.call('route=marketing%2Fexport&segment=all',{cookie:admin})).status,422);
  f.db.rpc=async(name,args)=>name==='marketing_list'?{total:5001,rows:[]}:original(name,args);
  assert.equal((await f.call('route=marketing%2Fexport&segment=campaigns',{cookie:admin})).status,422);
});

test('pedido con carrito guardado usa una operación transaccional y no confía en hashes del navegador',async()=>{
  const f=setup();let savedArgs;const original=f.db.rpc;
  f.db.rpc=async(name,args)=>name==='new_order_with_cart'?(savedArgs=args,original('new_order',args)):original(name,args);
  const saved=reference();
  const result=await f.call('orders/create',{method:'POST',body:{requestId:randomUUID(),draft:draft(),items:[{slug:'miel-multifloral',format:'1 kg',quantity:1}],savedCart:saved}});
  assert.equal(result.status,200);assert.equal(savedArgs.p_cart_id,saved.id);
  assert.equal(savedArgs.p_cart_hash,createHash('sha256').update(saved.token).digest('hex'));
});

test('recuperación conserva productos actuales y no duplica cantidades al repetirla',()=>{
  const state={lines:[{slug:'miel-multifloral',format:'1 kg',quantity:3}]};
  const lines=[{slug:'miel-multifloral',format:'1 kg',quantity:2},{slug:'miel-de-cerezo',format:'1 kg',quantity:1}];
  const restored=cartReducer(state,{type:'restore',lines});
  assert.equal(restored.lines[0].quantity,3);assert.equal(restored.lines.length,2);
  assert.deepEqual(cartReducer(restored,{type:'restore',lines}).lines,restored.lines);
  assert.equal(state.lines.length,1);
});

test('referencias locales descartan datos personales y enlaces inválidos; CSV neutraliza fórmulas',()=>{
  const ref=reference();
  assert.deepEqual(readSavedCart({getItem:()=>JSON.stringify({...ref,email:'private@example.com'})}),ref);
  assert.deepEqual(parseCartLink(`#recuperar=${ref.id}.${ref.token}`),{action:'recuperar',reference:ref});
  assert.equal(parseCartLink(`#recuperar=${ref.id}.short`),null);
  const csv=campaignCsv([{email:'guest@example.com',name:'  +CMD',paidOrders:0}], 'campaigns');
  assert.ok(csv.includes("'  +CMD"));
});

test('adaptador HTTP mantiene el token del carrito en JSON y autentica consultas admin del mismo origen',async()=>{
  const calls=[];const adapter=createHttpAdapter({fetcher:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({rows:[],total:0}),{status:200});}});
  const input=capture();await adapter.savedCart.capture(input);
  assert.equal(calls[0].url.includes(input.reference.token),false);
  assert.equal(JSON.parse(calls[0].options.body).reference.token,input.reference.token);
  await adapter.marketing.list({kind:'contacts',segment:'campaigns',query:'a+b@example.com'});
  assert.equal(new URL(calls[1].url,'https://honey.example').searchParams.get('query'),'a+b@example.com');
  assert.equal(calls[1].options.credentials,'same-origin');
});
