import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { resolve,extname } from 'node:path';
const root=resolve('dist');
const built=await readFile(resolve(root,'index.html'),'utf8');
const catalog=JSON.parse(/<script id="initial-catalog" type="application\/json">([\s\S]*?)<\/script>/.exec(built)[1]);
const currentCatalog=structuredClone(catalog);
const originalPrice=currentCatalog.find(p=>p.slug==='miel-de-cerezo').sizes[0].price;
currentCatalog.find(p=>p.slug==='miel-de-cerezo').sizes[0].price+=111;
const origin=process.env.SEO_TEST_ORIGIN||'http://127.0.0.1:5183';
const canonical=new URL(/rel="canonical" href="([^"]+)"/.exec(built)[1]).origin;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain'};
const server=process.env.SEO_TEST_ORIGIN?null:createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,origin);
  if(url.pathname==='/api'){
   const route=url.searchParams.get('route');res.setHeader('Content-Type','application/json');
   res.end(JSON.stringify(route==='catalog'?currentCatalog:route==='session'?null:[]));return;
  }
  const pathname=decodeURIComponent(url.pathname);
  const relative=pathname==='/'?'index.html':pathname.startsWith('/staff/')?'private.html':pathname.slice(1)+(extname(pathname)?'':'.html');
  const file=resolve(root,relative);if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/')){res.writeHead(400);res.end();return;}
  let body;try{body=await readFile(file)}catch{res.statusCode=404;body=await readFile(resolve(root,'404.html'));}
  res.setHeader('Content-Type',res.statusCode===404?types['.html']:types[extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(500);res.end();}
});
const delay=ms=>new Promise(done=>setTimeout(done,ms));let browser,socket,seq=0;const pending=new Map(),errors=[];
const send=(method,params={})=>new Promise((done,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'))},15000);pending.set(id,{done:r=>{clearTimeout(timer);done(r)},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const waitFor=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await delay(100)}throw Error(expression);};
const route=async path=>{await evaluate(`history.pushState({},'',${JSON.stringify(path)});dispatchEvent(new PopStateEvent('popstate'))`);await waitFor(`location.pathname===${JSON.stringify(path.split('?')[0])}`)};
try {
 if(server)await new Promise(done=>server.listen(5183,'127.0.0.1',done));
 for(const path of ['/','/productos','/productos/miel-multifloral','/productos/miel-de-cerezo','/productos/miel-de-avellana']){
  const response=await fetch(origin+path);assert.equal(response.status,200,path);const html=await response.text();assert.match(html,/<h1\b/);assert.match(html,/content="index, follow/);assert.match(html,/application\/ld\+json/);assert.match(html,/rel="canonical"/);assert.doesNotMatch(html.split('<script id="initial-catalog"')[0],/La ficha final|Compra de demostración/);
 }
 for(const path of ['/carrito','/checkout','/checkout/resultado','/staff/admin','/nosotros','/contacto']){const response=await fetch(origin+path);assert.equal(response.status,200,path);assert.match(await response.text(),/content="noindex, follow"/,path);}
 for(const path of ['/productos/no-existe','/pagina-no-existe']){const response=await fetch(origin+path);assert.equal(response.status,404,path);assert.match(await response.text(),/content="noindex, follow"/);}
 assert.equal((await(await fetch(origin+'/sitemap.xml')).text()).match(/<loc>/g).length,5);
 await mkdir('.preview-browser',{recursive:true});
 browser=spawn(process.env.EDGE_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9235',`--user-data-dir=${resolve('.preview-browser/seo-'+Date.now())}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let page;for(let i=0;i<60;i++){try{page=(await(await fetch('http://127.0.0.1:9235/json/list')).json()).find(p=>p.type==='page')}catch{}if(page)break;await delay(200)}assert.ok(page);
 socket=new WebSocket(page.webSocketDebuggerUrl);socket.addEventListener('message',({data})=>{const r=JSON.parse(data);if(r.id&&pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.done(r.result)}if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails.text)});await new Promise(done=>socket.addEventListener('open',done,{once:true}));await send('Runtime.enable');
 await send('Page.navigate',{url:origin+'/productos/miel-de-cerezo?utm_source=seo-check'});await waitFor("document.querySelector('.product-info') && document.title.includes('Cerezo')");
 await waitFor("!!document.querySelector('script[type=\"application/ld+json\"]')");
 const expectedPrice=process.env.SEO_TEST_ORIGIN?originalPrice:originalPrice+111;
 await waitFor(`JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'].find(x=>x['@type']==='Product').offers[0].price===${expectedPrice}`);
 assert.equal(await evaluate("document.querySelector('.product-info .price').textContent"),new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(expectedPrice),'El precio visible debe actualizarse junto con el marcado');
 assert.equal(await evaluate("document.querySelector('link[rel=canonical]').href"),canonical+'/productos/miel-de-cerezo');
 assert.equal(await evaluate("document.querySelectorAll('meta[name=description]').length"),1);
 await waitFor("!document.getElementById('initial-catalog') && [...document.querySelectorAll('button')].some(el=>el.textContent==='Agregar al carrito' && !el.disabled)");
 await evaluate("[...document.querySelectorAll('button')].find(el=>el.textContent==='Agregar al carrito').click()");await waitFor("document.querySelector('.cart-link span').textContent==='1'");
 await route('/carrito');await waitFor("document.title==='Tu carrito | Casa Miel'");assert.equal(await evaluate("document.querySelector('meta[name=robots]').content"),'noindex, follow');assert.equal(await evaluate("!!document.querySelector('script[type=\"application/ld+json\"]')"),false);await waitFor("document.querySelectorAll('.cart-item').length===1");
 await route('/checkout');await waitFor("!!document.querySelector('form[aria-label=\"Datos de compra\"]')");assert.match(await evaluate('document.title'),/Datos de compra/);
 await route('/staff');await waitFor("!!document.querySelector('input[type=password]')");assert.match(await evaluate('document.title'),/Acceso del equipo/);
 await route('/');await waitFor("document.querySelectorAll('.honey-dream__honey').length===3");await waitFor("document.querySelector('meta[name=robots]').content.startsWith('index,')");
 await send('Emulation.setDeviceMetricsOverride',{width:360,height:640,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollHeight<=innerHeight+1'),true);
 await evaluate("document.querySelector('.honey-dream__honey--cerezo').click()");await waitFor("!!document.querySelector('dialog[open]')");assert.equal(await evaluate("document.querySelector('link[rel=canonical]').href"),canonical+'/');await evaluate("document.querySelector('.honey-quick-view__more').click()");await waitFor("document.title.includes('Cerezo')");await waitFor("!!document.querySelector('.product-info')");
 const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve('.preview-browser/seo-product-mobile.png'),Buffer.from(screenshot.data,'base64'));
 await route('/productos/no-existe');await waitFor("document.title.includes('no encontrada')");assert.equal(await evaluate("document.querySelector('meta[name=robots]').content"),'noindex, follow');assert.equal(await evaluate("!!document.querySelector('link[rel=canonical]')"),false);
 assert.deepEqual(errors,[]);console.log('SEO HTTP y navegador: HTML sin JavaScript, 404, noindex, sitemap, navegación SPA, precio vigente, carrito, checkout, staff y móvil verificados. '+origin);
} catch(error){console.error(error);process.exitCode=1;}
finally{socket?.close();browser?.kill();if(server)await new Promise(done=>server.close(done));}
