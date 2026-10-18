import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4180',folder='evidence/v08';
const png=data=>Buffer.from(data.split(',')[1],'base64'),imageData=bytes=>`data:image/png;base64,${bytes.toString('base64')}`;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const errors=[],checks=[],views=[],outputs={},responsive=[];let formalRequests=0;
await fs.mkdir(`${folder}/checks`,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{if(r.url().includes('/reference/live-assets.svg'))formalRequests++;});
 await page.goto(`${base}/?camera=oblique`);await page.waitForFunction(()=>window.landscape?.ready);
 const target=(await page.evaluate(()=>window.landscape.stats())).targetCameraMatrix;
 for(const pose of ['oblique','top','side']){
  await page.getByLabel('检查视角',{exact:true}).selectOption(pose);await page.waitForFunction(v=>window.landscape.stats().cameraView===v,pose);
  const data=await page.evaluate(()=>window.landscape.export('terrain',false));
  assert.equal(data,await page.evaluate(()=>window.landscape.export('terrain',false)));
  await fs.writeFile(`${folder}/${pose==='oblique'?'05-free-inspection.png':`checks/${pose}.png`}`,png(data));
  const stats=await page.evaluate(()=>window.landscape.stats());assert.deepEqual(stats.targetCameraMatrix,target);views.push({pose,matrix:stats.inspectionCameraMatrix});
 }
 await page.getByLabel('检查视角',{exact:true}).selectOption('oblique');
 const canvas=page.locator('.viewport canvas'),r=await canvas.boundingBox(),x=r.x+r.width*.5,y=r.y+r.height*.55;
 const before=(await page.evaluate(()=>window.landscape.stats())).inspectionCameraMatrix;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+70,y+35,{steps:6});await page.mouse.up();
 assert.notDeepEqual((await page.evaluate(()=>window.landscape.stats())).inspectionCameraMatrix,before);
 const rotated=await page.evaluate(()=>window.landscape.export('terrain',false));
 await page.mouse.wheel(0,-140);await page.waitForTimeout(100);assert.notEqual(await page.evaluate(()=>window.landscape.export('terrain',false)),rotated);
 const zoomed=await page.evaluate(()=>window.landscape.export('terrain',false));
 await page.mouse.down({button:'right'});await page.mouse.move(x+30,y,{steps:5});await page.mouse.up({button:'right'});assert.notEqual(await page.evaluate(()=>window.landscape.export('terrain',false)),zoomed);
 await page.getByLabel('检查视角',{exact:true}).selectOption('target');
 checks.push('Free oblique/top/side inspected first; real pointer orbit/pan/zoom and fixed target camera restoration pass.');
 for(const [mode,mist,file,label] of [
  ['terrain',false,'01-terrain.png','纯地形'],['river',true,'02-river-light-mist.png','河流 + 轻雾'],['proxy',true,'03-proxy.png','Proxy 布局'],['assets',true,'04-formal-svg.png','正式 SVG 对照']
 ]){
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.waitForFunction(({mode,mist})=>window.landscape.view()===mode&&window.landscape.stats().clouds===mist&&window.landscape.stats().river===(mode!=='terrain'),{mode,mist});
  if(mode==='assets')await page.locator('.asset-overlay').evaluate(im=>im.decode());
  else assert.equal(formalRequests,0,'Formal artwork must not load before the fourth stage');
  const data=await page.evaluate(({mode,mist})=>window.landscape.export(mode,mist),{mode,mist});
  assert.equal(data,await page.evaluate(({mode,mist})=>window.landscape.export(mode,mist),{mode,mist}));
  const bytes=png(data);assert.equal(bytes.readUInt32BE(16),1600);assert.equal(bytes.readUInt32BE(20),900);
  await fs.writeFile(`${folder}/${file}`,bytes);outputs[mode]=data;
 }
 assert.equal(formalRequests,1);assert.notEqual(outputs.terrain,outputs.river);assert.notEqual(outputs.river,outputs.proxy);assert.notEqual(outputs.proxy,outputs.assets);
 checks.push('All four stages exported in order as deterministic 1600×900 PNGs; original SVG loaded only at stage four.');
 const current=await page.evaluate(()=>window.landscape.stats());
 const clearRiver=await page.evaluate(()=>window.landscape.export('river',false));await fs.writeFile(`${folder}/checks/river-no-mist.png`,png(clearRiver));
 const mistPixels=await page.evaluate(async ([clear,mist])=>{
  const read=src=>new Promise(resolve=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const x=c.getContext('2d');x.drawImage(im,0,0);resolve(x.getImageData(0,0,1600,900).data);};im.src=src;});
  const [a,b]=await Promise.all([read(clear),read(mist)]);let changed=0,max=0,sum=0;
  for(let i=0;i<a.length;i+=4){let delta=0;for(let k=0;k<3;k++)delta=Math.max(delta,Math.abs(a[i+k]-b[i+k]));if(delta)changed++;max=Math.max(max,delta);sum+=delta;}
  return {changedRatio:changed/(1600*900),maxChannelDelta:max,meanDelta:sum/(1600*900)};
 },[clearRiver,outputs.river]);
 assert.ok(mistPixels.changedRatio>0&&mistPixels.changedRatio<.35);assert.ok(mistPixels.maxChannelDelta<35);
 const after=await page.evaluate(()=>window.landscape.stats());assert.equal(after.clouds,current.clouds);assert.equal(after.river,current.river);
 await page.getByRole('button',{name:'河流 + 轻雾',exact:true}).click();await page.getByLabel('轻薄雾',{exact:true}).uncheck();
 assert.equal(await page.evaluate(()=>window.landscape.export()),clearRiver);
 await page.getByLabel('轻薄雾',{exact:true}).check();assert.equal(await page.evaluate(()=>window.landscape.export()),outputs.river);
 await page.getByLabel('线框',{exact:true}).check();await page.getByLabel('检查视角',{exact:true}).selectOption('oblique');
 await page.getByLabel('线框',{exact:true}).uncheck();await page.getByLabel('检查视角',{exact:true}).selectOption('target');
 assert.equal(await page.evaluate(()=>window.landscape.export()),outputs.river);
 const dl=page.waitForEvent('download');await page.getByRole('button',{name:'导出截图',exact:true}).click();const download=await dl;
 assert.ok(download.suggestedFilename().startsWith('landscape-v08'));await download.saveAs(`${folder}/checks/button-export.png`);
 assert.equal(hash(await fs.readFile(`${folder}/checks/button-export.png`)),hash(png(outputs.river)));
 checks.push('Thin mist changes only a bounded fraction of pixels; river/mist export states and target materials restore exactly. Actual download button matches the export.');
 await page.getByLabel('参考效果图对照',{exact:true}).check();await page.locator('.reference-image img').evaluate(im=>im.decode());
 for(const mode of ['overlay','wipe','side']){await page.getByLabel('比较方式',{exact:true}).selectOption(mode);assert.equal(await page.evaluate(()=>window.landscape.export()),outputs.river);}
 for(const width of [1600,1024,768,390]){
  await page.setViewportSize({width,height:1000});
  const sizes=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {width:r.width,height:r.height};};return {current:rect('.viewport'),reference:rect('.reference-image'),scroll:document.documentElement.scrollWidth};});
  assert.ok(Math.abs(sizes.current.width/sizes.current.height-16/9)<.002);assert.deepEqual(sizes.current,sizes.reference);assert.ok(sizes.scroll<=width);responsive.push({width,...sizes});
 }
 await page.setViewportSize({width:1600,height:1000});await page.screenshot({path:`${folder}/checks/desktop.png`,fullPage:true});
 const oldTerrain=imageData(await fs.readFile('evidence/v07/01-terrain-target.png')),oldClouds=imageData(await fs.readFile('evidence/v07/03-static-cloud-placeholder.png'));
 const comparison=await page.evaluate(async ({oldTerrain,oldClouds,outputs})=>{
  const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
  const ims=await Promise.all([load(oldTerrain),load(outputs.terrain),load('/reference/pastoral-target.png'),load(oldClouds),load(outputs.river),load(outputs.assets)]);
  const out=document.createElement('canvas');out.width=1600;out.height=900;const ctx=out.getContext('2d');ctx.fillStyle='#f1f3ef';ctx.fillRect(0,0,1600,900);
  ctx.fillStyle='#344435';ctx.font='28px Microsoft YaHei,sans-serif';ctx.fillText('V0.8 · 田园丘陵河谷重建',28,46);
  ctx.font='16px Microsoft YaHei,sans-serif';ctx.fillStyle='#526153';ctx.fillText('原目标正交相机 · 完整画幅等比适配 · 先地形，后资产对照',28,78);
  const labels=['此前 V0.7 · 无云地形','本轮 V0.8 · 连续草丘与河床','用户附图 · 田园构图目标','此前 V0.7 · 静态厚云占位','本轮 V0.8 · 河流与轻薄雾','本轮 V0.8 · 正式 SVG 叠加对照'];
  ims.forEach((im,i)=>{const x=28+(i%3)*522,y=i<3?132:482,w=500,h=281.25;ctx.fillStyle='#344435';ctx.font='18px Microsoft YaHei,sans-serif';ctx.fillText(labels[i],x,y-16);ctx.fillStyle='#dfe5dd';ctx.fillRect(x,y,w,h);const s=Math.min(w/im.width,h/im.height);ctx.drawImage(im,x+(w-im.width*s)/2,y+(h-im.height*s)/2,im.width*s,im.height*s);});
  ctx.fillStyle='#526153';ctx.font='16px Microsoft YaHei,sans-serif';ctx.fillText('本轮：宽平生活台地 / 左侧主田 + 两个小田块 / 21.9% 顺坡延伸 / 中央至右侧连续河流 / 低矮圆丘',28,809);
  ctx.fillText('对照差距：地表与远山着色仍简化，未加入参考图的植被、田间小路和天空细节；薄雾为静态空气透视。',28,843);
  ctx.fillText('正式 SVG 仅检查目标视角布局与落点；工程验证通过不代表人工美术验收通过。',28,877);
  return out.toDataURL('image/png');
 },{oldTerrain,oldClouds,outputs});
 await fs.writeFile(`${folder}/06-comparison.png`,png(comparison));
 await page.goto(`${base}/?view=assets&frame=integration&capture=1`);await page.waitForFunction(()=>window.landscape?.ready);await page.locator('.asset-overlay').evaluate(im=>im.decode());
 const integration=await page.evaluate(()=>window.landscape.export('assets',true));assert.equal(png(integration).readUInt32BE(16),1200);assert.equal(png(integration).readUInt32BE(20),800);
 await fs.writeFile(`${folder}/checks/svg-1200x800.png`,png(integration));
 checks.push('Reference side/overlay/wipe controls, four responsive widths and 1200×800 formal SVG framing pass.');
 assert.deepEqual(errors,[]);
 await fs.writeFile(`${folder}/browser-report.json`,JSON.stringify({version:'0.8',passed:true,artApproval:'PENDING_AUTHOR_REVIEW',checks,views,mistPixels,responsive,formalRequests,errors,browser:browser.version(),renderer:'Chromium SwiftShader'},null,2));
 console.log(JSON.stringify({passed:true,checks,mistPixels,errors},null,2));
}catch(error){await fs.writeFile(`${folder}/browser-report.json`,JSON.stringify({passed:false,checks,errors,error:String(error)},null,2));throw error;}
finally{await browser.close();}
