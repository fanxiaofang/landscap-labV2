import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const cache='.reference-cache/v06',out='evidence/v06';
const png=data=>Buffer.from(data.split(',')[1],'base64'),hash=data=>createHash('sha256').update(data).digest('hex');
const baseline=JSON.parse(await fs.readFile(`${cache}/baseline.json`,'utf8'));
const before=await fs.readFile(`${cache}/before.png`);assert.equal(hash(before),baseline.beforeSha256);
for(const f of ['src/world/projection.ts','src/terrain/ridgeSurface.ts','src/terrain/geometry.ts'])assert.equal(hash(await fs.readFile(f)),baseline.hashes[f],`${f} must be preserved`);
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],skyChecks=[];let formalRequests=0;
try {
 const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/reference/live-assets.svg',r=>{formalRequests++;return r.abort();});
 await page.goto('http://127.0.0.1:4180/?capture=1&clouds=0');await page.waitForFunction(()=>window.landscape?.ready);
 const beforeUrl=`data:image/png;base64,${before.toString('base64')}`;
 let after;
 for(const cloud of [false,true]){
  await page.evaluate(c=>window.landscape.setClouds(c),cloud);await page.waitForFunction(c=>window.landscape.stats().clouds===c,cloud);
  const data=await page.evaluate(c=>window.landscape.export('terrain',c),cloud);
  assert.equal(data,await page.evaluate(c=>window.landscape.export('terrain',c),cloud));
  const shot=await page.locator('.viewport canvas').screenshot();
  const check=await page.evaluate(async ({data,beforeUrl,shot})=>{
   const load=src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.src=src;});
   const exported=await load(data),before=await load(beforeUrl),screen=await load(shot),raw=document.querySelector('.viewport canvas');
   const read=im=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const ctx=c.getContext('2d');ctx.drawImage(im,0,0,1600,900);return ctx;};
   const a=read(raw),b=read(exported),c=read(before),d=read(screen),samples=[];
   for(const [x,y] of [[20,20],[800,40],[1400,100],[800,160]])samples.push({x,y,raw:[...a.getImageData(x,y,1,1).data],exported:[...b.getImageData(x,y,1,1).data],before:[...c.getImageData(x,y,1,1).data],screenshot:[...d.getImageData(x,y,1,1).data]});
   return {samples};
  },{data,beforeUrl,shot:`data:image/png;base64,${shot.toString('base64')}`});
  for(const s of check.samples){
   assert.equal(s.raw[3],255);assert.equal(s.exported[3],255);assert.equal(s.screenshot[3],255);
   assert.ok(s.raw.slice(0,3).every(v=>v>60),'Sky must not turn black');
   for(let i=0;i<3;i++){assert.ok(Math.abs(s.raw[i]-s.exported[i])<=1);assert.ok(Math.abs(s.raw[i]-s.screenshot[i])<=1);assert.ok(Math.abs(s.raw[i]-s.before[i])<=2,'Preserve autumn sky palette');}
  }
  skyChecks.push({clouds:cloud,...check});
  if(cloud)after=data;
 }
 await fs.writeFile(`${cache}/after.png`,png(after));
 const comparison=await page.evaluate(async ({before,after})=>{
  const load=src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.src=src;});
  const [a,b]=await Promise.all([load(before),load(after)]);
  const c=document.createElement('canvas');c.width=3248;c.height=980;const ctx=c.getContext('2d');ctx.fillStyle='#edf0ec';ctx.fillRect(0,0,c.width,c.height);
  ctx.font='24px Microsoft YaHei, sans-serif';ctx.fillStyle='#354135';
  ctx.fillText('修改前 · V0.5',16,34);ctx.fillText('修改后 · 山群后移与缩小 / 大尺度云区与局部云团',1632,34);
  ctx.drawImage(a,16,50,1600,900);ctx.drawImage(b,1632,50,1600,900);
  ctx.font='16px Microsoft YaHei, sans-serif';ctx.fillText('同一相机 · 每格 1600 × 900 · 16:9 · 仅中景山群 benchmark，待审阅',16,973);
  return c.toDataURL('image/png');
 },{before:beforeUrl,after});
 await fs.mkdir(out,{recursive:true});await fs.writeFile(`${out}/before-after-clouds.png`,png(comparison));
 assert.equal(formalRequests,0);assert.deepEqual(errors,[]);
 const report={passed:true,frame:baseline.frame,cameraUnchanged:true,terrainAlgorithmUnchanged:true,beforeSha256:baseline.beforeSha256,afterSha256:hash(png(after)),skyChecks,formalRequests,errors,artApproval:'PENDING_AUTHOR_REVIEW'};
 await fs.writeFile(`${cache}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,skyModes:skyChecks.length,cameraUnchanged:true,terrainAlgorithmUnchanged:true,formalRequests,errors,output:`${out}/before-after-clouds.png`},null,2));
}finally{await browser.close();}
