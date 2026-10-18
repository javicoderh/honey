import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const origin=process.env.LANDING_ORIGIN||'http://127.0.0.1:5182';
const server=process.env.LANDING_ORIGIN?null:await createServer({configFile:false,define:{'import.meta.env.VITE_DATA_MODE':JSON.stringify('demo')},server:{host:'127.0.0.1',port:5182,strictPort:true,watch:{ignored:['**/.preview-browser/**','**/.vercel/**']}},logLevel:'error'});
const delay=ms=>new Promise(done=>setTimeout(done,ms));
let browser,socket,sequence=0;const pending=new Map(),errors=[];
const send=(method,params={})=>new Promise((done,reject)=>{const id=++sequence;const timer=setTimeout(()=>reject(Error(method+' timeout')),15000);pending.set(id,{done:r=>{clearTimeout(timer);done(r)},reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const waitFor=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await delay(100)}throw Error(expression);};
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve('.preview-browser/'+name+'.png'),Buffer.from(r.data,'base64'));};
try {
 await mkdir('.preview-browser',{recursive:true});await server?.listen();
 browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9234',`--user-data-dir=${resolve('.preview-browser/landing-'+Date.now())}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let page;for(let i=0;i<60;i++){try{page=(await(await fetch('http://127.0.0.1:9234/json/list')).json()).find(p=>p.type==='page')}catch{}if(page)break;await delay(200)}assert.ok(page);
 socket=new WebSocket(page.webSocketDebuggerUrl);socket.addEventListener('message',({data})=>{const r=JSON.parse(data);if(r.id&&pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.done(r.result)}if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails.text)});await new Promise(done=>socket.addEventListener('open',done,{once:true}));await send('Runtime.enable');
 await send('Page.navigate',{url:origin});await waitFor("document.querySelectorAll('.honey-dream__honey').length===3");
 assert.equal(await evaluate("!!document.querySelector('dialog')"),false);
 for(const [width,height] of [[1440,900],[1280,800],[768,1024],[390,844],[360,640],[320,568],[812,375]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});await delay(120);
  assert.equal(await evaluate('document.documentElement.scrollHeight<=innerHeight+1 && document.documentElement.scrollWidth<=innerWidth+1'),true,`overflow ${width}`);
  assert.equal(await evaluate("[...document.querySelectorAll('.honey-dream__honey')].every(el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight && r.top>=0})"),true,`visible choices ${width}`);
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await shot('landing-desktop');
 for(const id of ['multifloral','cerezo','avellana']){
  await evaluate(`document.querySelector('.honey-dream__honey--${id}').focus();document.querySelector('.honey-dream__honey--${id}').click()`);await waitFor("!!document.querySelector('dialog[open]')");await delay(1150);
  assert.equal(await evaluate('location.pathname'),'/');assert.equal(await evaluate("getComputedStyle(document.querySelector('.honey-quick-view__vertical')).animationName"),'honey-type-down');assert.equal(await evaluate("getComputedStyle(document.querySelector('.honey-quick-view__name')).animationName"),'honey-type-left');
  if(id==='cerezo'){assert.equal(await evaluate("getComputedStyle(document.querySelector('.honey-quick-view__name')).color"),'rgb(255, 255, 255)');await shot('landing-cerezo-desktop')}
  await evaluate("document.querySelector('.honey-quick-view__add').click()");await waitFor("document.querySelector('.honey-quick-view__notice').textContent.includes('Producto agregado')");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await waitFor("!document.querySelector('dialog')");
  assert.equal(await evaluate(`document.activeElement.classList.contains('honey-dream__honey--${id}')`),true,'focus restored');
 }
 assert.equal(await evaluate("document.querySelector('.cart-link span').textContent"),'3');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await shot('landing-mobile');await evaluate("document.querySelector('.honey-dream__honey--cerezo').click()");await delay(1150);await shot('landing-cerezo-mobile');
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
 await evaluate("document.querySelector('.honey-quick-view__more').click()");await waitFor("location.pathname==='/productos/miel-de-cerezo'");assert.equal(await evaluate("!!document.querySelector('dialog')"),false);assert.equal(await evaluate("document.body.style.overflow"),'');
 await evaluate("history.pushState({},'','/');dispatchEvent(new PopStateEvent('popstate'))");await waitFor("!!document.querySelector('.honey-dream__honey--cerezo')");
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await evaluate("document.querySelector('.honey-dream__honey--cerezo').click()");await waitFor("!!document.querySelector('dialog[open]')");assert.equal(await evaluate("getComputedStyle(document.querySelector('dialog')).animationName"),'none');await evaluate("document.querySelector('.honey-quick-view__close').click()");await waitFor("!document.querySelector('dialog')");
 assert.deepEqual(errors,[]);console.log('Landing verificada: 7 tamaños sin scroll; tres modales; animaciones; compra de cada miel; Escape y foco; ficha completa; limpieza de scroll; movimiento reducido. Origen: '+origin);
} catch(e){console.error(e);process.exitCode=1;if(socket?.readyState===1)await shot('landing-failure').catch(()=>{});}
finally {socket?.close();browser?.kill();await server?.close();}
