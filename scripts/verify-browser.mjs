import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4180';
const folder='evidence/v04';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],checks=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
const png=data=>Buffer.from(data.split(',')[1],'base64');
const size=b=>({width:b.readUInt32BE(16),height:b.readUInt32BE(20)});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 let formalRequests=0;await page.route('**/reference/live-assets.svg',route=>{formalRequests++;return route.abort();});
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.landscape?.ready);
 assert.equal(await page.getByLabel('秋季定稿对照',{exact:true}).isChecked(),true);
 assert.equal(await page.getByLabel('静态云海',{exact:true}).isChecked(),false);
 assert.equal(await page.evaluate(()=>window.landscape.view()),'terrain');
 await page.locator('.reference-image img').evaluate(img=>img.decode());
 const referenceSource=await fs.readFile('../references/01_autumn_approved.png.png');
 const referenceCopy=await fs.readFile('public/reference/autumn-approved.png');
 assert.equal(hash(referenceSource),hash(referenceCopy));
 const bounds=await page.evaluate(()=>{
  const rect=s=>{const b=document.querySelector(s).getBoundingClientRect();return {y:b.y,width:b.width,height:b.height};};
  return {current:rect('.viewport'),reference:rect('.reference-image')};
 });
 assert.deepEqual(bounds.current,bounds.reference);assert.ok(Math.abs(bounds.current.width/bounds.current.height-16/9)<.001);
 checks.push({name:'approved autumn is the default, original bytes preserved, aligned equal 16:9 frames',passed:true,bounds,referenceSha256:hash(referenceSource)});
 const exports={};
 for(const [key,view,clouds,file] of [['terrain','terrain',false,'01-terrain-16x9.png'],['clouds','terrain',true,'02-static-clouds-16x9.png'],['proxy','proxy',true,'03-proxy-clouds-16x9.png']]){
  const data=await page.evaluate(([view,clouds])=>window.landscape.export(view,clouds),[view,clouds]);
  assert.equal(data,await page.evaluate(([view,clouds])=>window.landscape.export(view,clouds),[view,clouds]));
  const buffer=png(data);assert.deepEqual(size(buffer),{width:1600,height:900});exports[key]=data;await fs.writeFile(`${folder}/${file}`,buffer);
  assert.equal((await page.evaluate(()=>window.landscape.stats())).clouds,false);
  checks.push({name:file,passed:true,deterministic:true,size:size(buffer),sha256:hash(buffer)});
 }
 assert.notEqual(exports.terrain,exports.clouds);assert.notEqual(exports.clouds,exports.proxy);
 await page.getByLabel('静态云海',{exact:true}).check();
 assert.equal(await page.evaluate(()=>window.landscape.export()),exports.clouds);
 await page.getByLabel('静态云海',{exact:true}).uncheck();
 assert.equal(await page.evaluate(()=>window.landscape.export()),exports.terrain);
 checks.push({name:'cloud toggle alters image, exports restore state, clear frame exactly recovers',passed:true});
 const sheet=await page.evaluate(async frames=>{
  const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
  const ref=await load('/reference/autumn-approved.png'),terrain=await load(frames.terrain),clouds=await load(frames.clouds);
  const c=document.createElement('canvas');c.width=3248;c.height=1944;const ctx=c.getContext('2d');
  ctx.fillStyle='#eef0ec';ctx.fillRect(0,0,c.width,c.height);ctx.font='24px Microsoft YaHei, sans-serif';ctx.fillStyle='#354135';
  const panel=(im,x,y,label)=>{ctx.fillText(label,x,y+32);const scale=Math.min(1600/im.width,900/im.height);const w=im.width*scale,h=im.height*scale;ctx.drawImage(im,x+(1600-w)/2,y+48+(900-h)/2,w,h);};
  panel(ref,16,0,'秋季定稿 · 唯一主要美术基准');panel(terrain,1632,0,'V0.4 · 纯地形 / 无云海');
  panel(ref,16,972,'秋季定稿 · 相同 1600 × 900 画框');panel(clouds,1632,972,'V0.4 · 静态云海占位 / 美术待审阅');return c.toDataURL('image/png');
 },exports);
 await fs.writeFile(`${folder}/04-autumn-same-scale-comparison.png`,png(sheet));
 await page.getByLabel('静态云海',{exact:true}).check();await page.getByLabel('构图轮廓',{exact:true}).check();
 await page.screenshot({path:`${folder}/05-aligned-contours.png`,fullPage:true});
 for(const mode of ['overlay','wipe']){
  await page.getByLabel('比较方式',{exact:true}).selectOption(mode);
  await page.locator('.reference-overlay').evaluate(img=>img.decode());
  await page.getByLabel('对照比例',{exact:true}).fill(mode==='overlay'?'40':'50');
  assert.equal(await page.evaluate(()=>window.landscape.export()),exports.clouds);
  await page.locator('.viewport').screenshot({path:`${folder}/06-${mode}.png`});
 }
 checks.push({name:'side-by-side, opacity, wipe and reference contours do not mutate terrain exports',passed:true});
 await page.getByLabel('构图轮廓',{exact:true}).uncheck();await page.getByLabel('比较方式',{exact:true}).selectOption('side');
 await page.getByRole('button',{name:'Proxy 占位',exact:true}).click();await page.locator('.proxy-overlay').evaluate(img=>img.decode());
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'导出截图'}).click();const download=await downloading;await download.saveAs(`${folder}/button-export.png`);
 assert.equal(hash(await fs.readFile(`${folder}/button-export.png`)),hash(png(exports.proxy)));
 await page.getByLabel('投影校准',{exact:true}).check();assert.ok((await page.locator('.calibration').textContent()).includes('16.445'));await page.getByLabel('投影校准',{exact:true}).uncheck();
 await page.getByLabel('线框',{exact:true}).check();assert.equal((await page.evaluate(()=>window.landscape.stats())).wireframe,true);await page.getByLabel('线框',{exact:true}).uncheck();
 await page.screenshot({path:`${folder}/07-desktop-review.png`,fullPage:true});
 checks.push({name:'actual export button, calibration and wireframe',passed:true});
 const responsive=[];
 for(const width of [1600,1024,768,390]){
  await page.setViewportSize({width,height:1000});
  const metrics=await page.evaluate(()=>{
   const rect=s=>{const b=document.querySelector(s).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
   return {viewport:rect('.viewport'),canvas:rect('canvas'),proxy:rect('.proxy-overlay'),reference:rect('.reference-image'),scrollWidth:document.documentElement.scrollWidth};
  });
  assert.ok(Math.abs(metrics.viewport.width/metrics.viewport.height-16/9)<.001);assert.deepEqual(metrics.canvas,metrics.proxy);
  assert.equal(metrics.viewport.width,metrics.reference.width);assert.equal(metrics.viewport.height,metrics.reference.height);assert.ok(metrics.scrollWidth<=width);
  responsive.push({width,...metrics});
 }
 await page.screenshot({path:`${folder}/08-mobile-review.png`,fullPage:true});checks.push({name:'responsive synchronized frame sizes',passed:true,responsive});
 await page.goto(base+'/?frame=integration&view=proxy',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.landscape?.ready);await page.locator('.proxy-overlay').evaluate(img=>img.decode());
 const integration=await page.evaluate(()=>window.landscape.export());assert.deepEqual(size(png(integration)),{width:1200,height:800});
 const contract=await page.locator('.proxy-overlay').evaluate(img=>{
  const xml=new DOMParser().parseFromString(decodeURIComponent(img.src.split(',')[1]),'image/svg+xml');
  const b=img.getBoundingClientRect(),c=document.querySelector('canvas').getBoundingClientRect();
  return {viewBox:xml.documentElement.getAttribute('viewBox'),transform:xml.querySelector('g').getAttribute('transform'),aligned:b.width===c.width&&b.height===c.height};
 });
 assert.equal(contract.viewBox,'0 0 1200 800');assert.equal(contract.transform,'translate(0 62.5) scale(0.75)');assert.ok(contract.aligned);
 await fs.writeFile(`${folder}/09-integration-1200x800.png`,png(integration));
 checks.push({name:'1200x800 SVG-layer contract with Proxy only, no formal artwork integration',passed:true,contract});
 assert.equal(formalRequests,0);assert.deepEqual(errors,[]);
 checks.push({name:'no formal SVG requests across all tested modes; no browser errors',passed:true,formalRequests});
 const report={version:'0.4',passed:true,artApproval:'PENDING_AUTHOR_REVIEW',artLimitations:['Ridge silhouettes remain angular and some shoulders still merge; not yet the approved forms.','Cloud surface reads as broad bands, not the approved soft cloud masses.','Foreground field edges remain too regular.','Uncovered mountain bases still merge into a substantial background mass.'],url:base,browser:browser.version(),renderer:'Chromium SwiftShader; not a GPU benchmark',checks,errors};
 await fs.writeFile(`${folder}/browser-report.json`,JSON.stringify(report,null,2));await fs.writeFile('evidence/browser-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,formalRequests,errors},null,2));
} catch(error){await fs.writeFile(`${folder}/browser-report.json`,JSON.stringify({passed:false,checks,errors,error:String(error)},null,2));throw error;}finally{await browser.close();}
