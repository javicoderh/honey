import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import handler from '../api/index.js';

const origin='http://127.0.0.1:5181';process.env.APP_ORIGIN=origin;
const credentials=JSON.parse(await readFile(new URL('../.vercel/admin-credentials.local.json',import.meta.url),'utf8'));
const email=`browser-cart-${randomUUID()}@example.com`;
const profile=resolve(`.preview-browser/marketing-${Date.now()}`);
const downloadPath=resolve(`.preview-browser/marketing-downloads-${Date.now()}`);
await mkdir(downloadPath,{recursive:true});
const server=await createServer({configFile:false,define:{'import.meta.env.VITE_DATA_MODE':JSON.stringify('api')},plugins:[{name:'connected-api',configureServer(vite){vite.middlewares.use('/api',(req,res)=>{req.url='/api'+req.url;handler(req,res);});}}],server:{host:'127.0.0.1',port:5181,strictPort:true,watch:{ignored:['**/.preview-browser/**','**/.vercel/**']}},logLevel:'error'});
const delay=ms=>new Promise(done=>setTimeout(done,ms));
let browser,socket,sequence=0;const requests=new Map();const errors=[];
const send=(method,params={})=>new Promise((done,reject)=>{const id=++sequence;const timer=setTimeout(()=>{requests.delete(id);reject(Error(`Tiempo agotado: ${method}`));},15000);requests.set(id,{done:result=>{clearTimeout(timer);done(result);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error((result.exceptionDetails.exception?.description??result.exceptionDetails.text).split('\n')[0]);return result.result.value;};
const waitFor=async expression=>{for(let attempt=0;attempt<200;attempt++){if(await evaluate(expression))return;await delay(100);}throw Error('No se alcanzó el estado esperado de Marketing.');};
const fill=async(selector,value)=>{await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);return evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);};
const click=text=>evaluate(`(()=>{const el=[...document.querySelectorAll('button,a')].find(item=>item.textContent.trim()===${JSON.stringify(text)} || item.querySelector('strong')?.textContent.trim()===${JSON.stringify(text)});if(!el)throw Error('Control no encontrado');el.click();})()`);
const navigate=path=>evaluate(`history.pushState({},'',${JSON.stringify(path)});dispatchEvent(new PopStateEvent('popstate'))`);
const report={scope:'browser-supabase-marketing',startedAt:new Date().toISOString(),checks:[]};
try{
  await server.listen();
  browser=spawn(process.env.EDGE_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--remote-debugging-port=9233',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let page;for(let attempt=0;attempt<60;attempt++){try{page=(await(await fetch('http://127.0.0.1:9233/json/list')).json()).find(item=>item.type==='page');}catch{}if(page)break;await delay(200);}assert.ok(page,'No se pudo iniciar Edge.');
  socket=new WebSocket(page.webSocketDebuggerUrl);socket.addEventListener('message',({data})=>{const result=JSON.parse(data);if(result.id && requests.has(result.id)){const pending=requests.get(result.id);requests.delete(result.id);result.error?pending.reject(Error('Error de protocolo')):pending.done(result.result);}if(result.method==='Runtime.exceptionThrown')errors.push('Error de ejecución');});
  await new Promise(done=>socket.addEventListener('open',done,{once:true}));await send('Runtime.enable');
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath});
  await send('Page.navigate',{url:`${origin}/productos/miel-multifloral`});
  await waitFor("[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='Agregar al carrito' && !el.disabled)");await click('Agregar al carrito');await navigate('/carrito');
  await waitFor("!!document.querySelector('input[name=\"savedCart.email\"]')");
  assert.equal(await evaluate("document.querySelector('[name=\"savedCart.recoveryConsent\"]').checked"),false);
  assert.equal(await evaluate("document.querySelector('[name=\"savedCart.marketingConsent\"]').checked"),false);
  await fill('[name="savedCart.email"]',email);await fill('[name="savedCart.name"]','PRUEBA NAVEGADOR MARKETING');await click('Guardar para después');
  await waitFor("document.body.innerText.includes('Autoriza el recordatorio')");
  await evaluate("document.querySelector('[name=\"savedCart.recoveryConsent\"]').click();document.querySelector('[name=\"savedCart.marketingConsent\"]').click()");await click('Guardar para después');
  await waitFor("document.body.innerText.includes('Tu carrito está guardado')");
  const reference=await evaluate("JSON.parse(localStorage.getItem('casa-miel.saved-cart.v1'))");assert.ok(reference.id && reference.token);
  assert.equal(await evaluate(`localStorage.getItem('casa-miel.saved-cart.v1').includes(${JSON.stringify(email)})`),false);
  await fill('.cart-item input[type=number]','2');await delay(2000);
  report.checks.push('Consentimientos separados y sincronización de cantidades');
  await navigate('/staff');await waitFor("!!document.querySelector('input[type=email]')");await fill('input[type=email]',credentials.email);await fill('input[type=password]',credentials.password);await click('Iniciar sesión');await waitFor("location.pathname==='/staff/admin'");await click('Marketing');
  await waitFor("document.body.innerText.includes('Carritos guardados')");assert.equal(await evaluate("!!document.querySelector('.marketing-table')"),false);
  await click('Carritos guardados');await fill('input[type=search]',email);await waitFor(`document.querySelector('.marketing-table')?.innerText.includes(${JSON.stringify(email)})`);
  await waitFor("document.querySelector('.marketing-table').innerText.includes('× 2')");
  await click('Contactos y recompra');await fill('input[type=search]',email);await waitFor("document.querySelector('.marketing-table')?.innerText.includes('Catálogos y promociones autorizados')");
  await click('Exportar catálogo / promociones');await waitFor("document.body.innerText.includes('Exportación preparada:')");
  let csv;for(let attempt=0;attempt<50;attempt++){try{csv=await readFile(resolve(downloadPath,'casa-miel-campaigns.csv'),'utf8');break;}catch{await delay(100);}}assert.ok(csv?.includes(email),'La descarga debe incluir el contacto autorizado.');assert.ok(csv.includes('#baja='));
  report.checks.push('Dashboard admin, filtros, consentimiento y descarga CSV');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
  const marketingShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve('.preview-browser/marketing-mobile.png'),Buffer.from(marketingShot.data,'base64'));
  await click('Dar de baja');await waitFor("!!document.querySelector('dialog[open]')");await click('Registrar baja');await waitFor("document.querySelector('.marketing-table')?.innerText.includes('Baja de correos')");
  await evaluate("localStorage.removeItem('casa-miel.cart.v1');localStorage.removeItem('casa-miel.saved-cart.v1')");
  await send('Page.navigate',{url:`${origin}/carrito#recuperar=${reference.id}.${reference.token}`});await waitFor("[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='Recuperar selección')");await click('Recuperar selección');
  await waitFor("document.querySelector('.cart-item input[type=number]')?.value==='2'");
  report.checks.push('Recuperación privada en otro carrito sin perder cantidades');
  await send('Page.navigate',{url:`${origin}/carrito#baja=${reference.id}.${reference.token}`});await waitFor("[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='Confirmar baja de correos')");await click('Confirmar baja de correos');await waitFor("document.body.innerText.includes('Baja registrada.')");
  const recoveryShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve('.preview-browser/cart-recovery-mobile.png'),Buffer.from(recoveryShot.data,'base64'));
  report.checks.push('Baja pública confirmada y vista móvil sin desbordamiento');
  assert.deepEqual(errors,[]);report.passed=true;console.log('Navegador Marketing: captura, permisos, sincronización, dashboard, exportación, recuperación, bajas y móvil verificados con Supabase real.');
}catch(error){console.error(error.message);report.passed=false;report.error=error.message;process.exitCode=1;if(socket?.readyState===1){const capture=await send('Page.captureScreenshot',{format:'png'}).catch(()=>null);if(capture)await writeFile(resolve('.preview-browser/marketing-failure.png'),Buffer.from(capture.data,'base64'));}}
finally{
  if(socket?.readyState===1)await evaluate("fetch('/api?route=logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})").catch(()=>{});
  try{
    const key=process.env.SUPABASE_SECRET_KEY;const headers={apikey:key,...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{})};
    const db=process.env.SUPABASE_URL+'/rest/v1/';const contactsResponse=await fetch(db+`honey_marketing_contacts?email=eq.${encodeURIComponent(email)}&select=id`,{headers});assert.ok(contactsResponse.ok);
    for(const contact of await contactsResponse.json())for(const [table,column] of [['honey_consent_events','contact_id'],['honey_saved_carts','contact_id'],['honey_marketing_contacts','id']]){
      const result=await fetch(db+`${table}?${column}=eq.${contact.id}`,{method:'DELETE',headers});assert.ok(result.ok,'No se pudo retirar el contacto técnico.');
    }
    report.cleanup=true;
  }catch{report.cleanup=false;process.exitCode=1;console.error('Revisar limpieza del contacto técnico.');}
  socket?.close();browser?.kill();await server.close();report.finishedAt=new Date().toISOString();await writeFile(resolve('.preview-browser/marketing-browser-report.json'),JSON.stringify(report,null,2));
}
