import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4180',folder='evidence/b1';
const png=s=>Buffer.from(s.split(',')[1],'base64'),data=b=>`data:image/png;base64,${b.toString('base64')}`,hash=b=>createHash('sha256').update(b).digest('hex');
const errors=[],checks=[],states=[],responsive=[],requests=[];const output={};
await fs.mkdir(`${folder}/checks`,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
 const save=async(file,fg=false)=>{const d=await page.evaluate(f=>window.b1.export(f),fg);const b=png(d);await fs.writeFile(`${folder}/${file}`,b);return d;};
 await page.goto(`${base}/?mode=b1&camera=oblique`);await page.waitForFunction(()=>window.b1?.ready);
 const target=(await page.evaluate(()=>window.b1.stats())).targetMatrix;
 // Inspect the unmasked, real geometry before target/composite evidence.
 await page.getByLabel('中性材质',{exact:true}).check();
 for(const pose of ['oblique','top','side']){
  await page.getByLabel('检查视角',{exact:true}).selectOption(pose);await page.waitForFunction(p=>window.b1.stats().view===p,pose);
  await save(pose==='oblique'?'02-free-inspection.png':`checks/${pose}.png`);
  assert.deepEqual((await page.evaluate(()=>window.b1.stats())).targetMatrix,target);
 }
 await page.getByLabel('检查视角',{exact:true}).selectOption('oblique');
 const rect=await page.locator('.viewport canvas').boundingBox(),cx=rect.x+rect.width*.52,cy=rect.y+rect.height*.55;
 const before=(await page.evaluate(()=>window.b1.stats())).inspectionMatrix;
 await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+60,cy+25,{steps:5});await page.mouse.up();
 assert.notDeepEqual((await page.evaluate(()=>window.b1.stats())).inspectionMatrix,before);
 const rotated=await page.evaluate(()=>window.b1.export());await page.mouse.wheel(0,-130);await page.waitForTimeout(100);assert.notEqual(await page.evaluate(()=>window.b1.export()),rotated);
 const zoomed=await page.evaluate(()=>window.b1.export());await page.mouse.down({button:'right'});await page.mouse.move(cx+15,cy,{steps:4});await page.mouse.up({button:'right'});assert.notEqual(await page.evaluate(()=>window.b1.export()),zoomed);
 checks.push('Free oblique, top and side geometry; real pointer orbit, pan, zoom; target matrix unchanged.');
 await page.getByLabel('检查视角',{exact:true}).selectOption('target');await page.getByLabel('中性材质',{exact:true}).uncheck();
 output.only=await save('01-mid-far-3d-only.png');assert.equal(output.only,await page.evaluate(()=>window.b1.export(false)));
 assert.equal(requests.filter(u=>u.endsWith('/reference/live-overview.svg')).length,0);
 assert.equal(requests.filter(u=>/\/src\/(terrain|composition)\//.test(u)||u.includes('/src/world/renderer')).length,0,'B1 must not import V0.8 terrain/assets runtime');
 await page.getByLabel('中性材质',{exact:true}).check();const neutral=await save('checks/neutral-light-left.png');
 await page.getByLabel('反向侧光',{exact:true}).check();const reversed=await save('checks/neutral-light-right.png');
 const lightChange=await page.evaluate(async([a,b])=>{
  const read=src=>new Promise(resolve=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const x=c.getContext('2d');x.drawImage(im,0,0);resolve(x.getImageData(0,0,1600,900).data);};im.src=src;});
  const [x,y]=await Promise.all([read(a),read(b)]);let changed=0,total=0,max=0;
  for(let i=0;i<x.length;i+=4){const d=Math.max(...[0,1,2].map(k=>Math.abs(x[i+k]-y[i+k])));if(d>8)changed++;total+=d;max=Math.max(max,d);}return {changedRatio:changed/(1600*900),meanDelta:total/(1600*900),maxDelta:max};
 },[neutral,reversed]);assert.ok(lightChange.changedRatio>.08&&lightChange.maxDelta>20);
 await page.getByLabel('反向侧光',{exact:true}).uncheck();await page.getByLabel('中性材质',{exact:true}).uncheck();assert.equal(await page.evaluate(()=>window.b1.export(false)),output.only);
 await page.getByLabel('河流',{exact:true}).uncheck();const dry=await save('checks/no-water.png');assert.notEqual(dry,output.only);await page.getByLabel('河流',{exact:true}).check();
 checks.push('Deterministic 3D-only export; no SVG or V0.8 runtime import; neutral-light reversal measurably changes real surface shading.');
 await page.getByRole('button',{name:'SVG Composite',exact:true}).click();await page.locator('.b1-foreground').evaluate(im=>im.decode());
 output.composite=await save('03-svg-composite.png',true);assert.notEqual(output.composite,output.only);
 await page.locator('.viewport').screenshot({path:`${folder}/checks/dom-composite.png`});
 // Check that all required original assets survive the foreground adapter.
 const assets=await page.evaluate(async()=>{const im=document.querySelector('.b1-foreground'),s=await (await fetch(im.src)).text(),d=new DOMParser().parseFromString(s,'image/svg+xml');return {present:['panoramic-world-stage','master-axonometric-ground-plane','living-cottage-haven','wooden-cabin-cluster','yorkshire-sheep-flock-and-dressing','yorkshire-sheep-pen-cluster','yorkshire-railway-viaduct','ribblehead-steam-train','tractor-in-field'].filter(id=>d.getElementById(id)),oldMountains:!!d.getElementById('lowpoly-distant-mountains'),sky:!!d.getElementById('parallax-sky-layer')};});
 assert.equal(assets.present.length,9);assert.equal(assets.oldMountains,false);assert.equal(assets.sky,false);
 const dl=page.waitForEvent('download');await page.getByRole('button',{name:'导出截图',exact:true}).click();const download=await dl;await download.saveAs(`${folder}/checks/button-export.png`);assert.equal(hash(await fs.readFile(`${folder}/checks/button-export.png`)),hash(png(output.composite)));
 checks.push('Original SVG meadow/house/sheep/facilities/bridge/train/tractor preserved; old sky/mountains excluded; real download equals composite export.');
 const navs=[{name:'wide-left-up',x:-100,y:-45,zoom:.9},{name:'wide-right-down',x:100,y:45,zoom:.9},{name:'close-left-down',x:-100,y:45,zoom:1.18},{name:'close-right-up',x:100,y:-45,zoom:1.18},{name:'pan-left',x:-100,y:0,zoom:1},{name:'pan-right',x:100,y:0,zoom:1}];
 for(const {name,...nav} of navs){await page.evaluate(n=>window.b1.setNavigation(n),nav);await page.waitForFunction(n=>JSON.stringify(window.b1.stats().navigation)===JSON.stringify(n),nav);await save(`checks/${name}-composite.png`,true);await save(`checks/${name}-only.png`,false);states.push({name,...await page.evaluate(()=>window.b1.stats())});}
 // Parallax toggles only the distant layers, not the foreground or target matrix.
 await page.getByLabel('轻微远景视差',{exact:true}).uncheck();const noParallax=await save('checks/pan-right-no-parallax.png');await page.getByLabel('轻微远景视差',{exact:true}).check();assert.notEqual(noParallax,await page.evaluate(()=>window.b1.export(false)));
 await page.getByRole('button',{name:'复位目标相机',exact:true}).click();assert.equal(await page.evaluate(()=>window.b1.export(true)),output.composite);
 const canvas=page.locator('.viewport canvas'),r=await canvas.boundingBox(),x=r.x+r.width*.5,y=r.y+r.height*.5;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y+15,{steps:5});await page.mouse.up();await page.waitForFunction(()=>window.b1.stats().navigation.x!==0);
 await page.mouse.wheel(0,-100);await page.waitForTimeout(100);assert.ok((await page.evaluate(()=>window.b1.stats())).navigation.zoom>1);
 await page.getByRole('button',{name:'复位目标相机',exact:true}).click();
 for(const width of [1600,1024,768,390]){await page.setViewportSize({width,height:1100});const bounds=await page.evaluate(()=>{const r=document.querySelector('.viewport').getBoundingClientRect();return {width:r.width,height:r.height,scroll:document.documentElement.scrollWidth};});assert.ok(Math.abs(bounds.width/bounds.height-16/9)<.002);assert.ok(bounds.scroll<=width);responsive.push({width,...bounds});}
 await page.setViewportSize({width:1600,height:1100});await page.screenshot({path:`${folder}/checks/desktop.png`,fullPage:true});
 checks.push('Six target navigation boundary states, 3D-only plus composite; pointer pan/zoom, reset, parallax and four responsive widths.');
 // Equal 16:9 cells; contain each entire reference rather than stretching it.
 const v08=data(await fs.readFile('evidence/v08/01-terrain.png')),oldSvg=data(await fs.readFile('public/reference/live-overview.png'));
 const comparison=await page.evaluate(async({output,v08})=>{
  const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
  const images=await Promise.all([load('/reference/pastoral-target.png'),load(v08),load(output.only),load(output.composite)]);
  const out=document.createElement('canvas');out.width=1600;out.height=1100;const c=out.getContext('2d');c.fillStyle='#eef0e9';c.fillRect(0,0,out.width,out.height);
  c.fillStyle='#253d37';c.font='26px Microsoft YaHei,sans-serif';c.fillText('Phase B1 · 目标构图 / V0.8 / 3D 中远景 / SVG 合成',24,42);
  const labels=['柔和丘陵目标图','V0.8 基线 · 原目标正交','B1 · 中远景 3D Only','B1 · 原始 SVG 前景合成'];
  images.slice(0,4).forEach((im,i)=>{const x=24+i%2*788,y=100+Math.floor(i/2)*485,w=764,h=429.75;c.font='18px Microsoft YaHei,sans-serif';c.fillStyle='#253d37';c.fillText(labels[i],x,y-15);c.fillStyle='#d9ded5';c.fillRect(x,y,w,h);const s=Math.min(w/im.width,h/im.height);c.drawImage(im,x+(w-im.width*s)/2,y+(h-im.height*s)/2,im.width*s,im.height*s);});
  c.font='16px Microsoft YaHei,sans-serif';c.fillStyle='#40564c';c.fillText('各格使用相同 16:9 画框，完整原图等比适配。B1 下方浅灰为未建模的 SVG 前景空间。',24,1050);
  c.fillText('可见改进：独立山体、侧坡受光、谷口与层间遮挡。仍需人工审阅：远山节奏、材质简化、SVG 边界与农田衔接。',24,1080);
  return out.toDataURL('image/png');
 },{output,v08});await fs.writeFile(`${folder}/04-reference-comparison.png`,png(comparison));
 // Preserve the original SVG comparison separately at the same delivery size.
 const svgComparison=await page.evaluate(async({oldSvg,current})=>{const out=document.createElement('canvas');out.width=1600;out.height=900;const c=out.getContext('2d');c.fillStyle='#eef0e9';c.fillRect(0,0,1600,900);const ims=await Promise.all([oldSvg,current].map(src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.src=src;})));ims.forEach((im,i)=>{const x=20+i*800,y=170,w=760,h=506.66,s=Math.min(w/im.width,h/im.height);c.drawImage(im,x+(w-im.width*s)/2,y+(h-im.height*s)/2,im.width*s,im.height*s);c.fillStyle='#253d37';c.font='22px Microsoft YaHei,sans-serif';c.fillText(i?'B1 · 3D 中远景 + 原始 SVG 前景':'原始 Live With Me · SVG 世界',x,130);});return out.toDataURL();},{oldSvg,current:output.composite});await fs.writeFile(`${folder}/checks/original-svg-comparison.png`,png(svgComparison));
 await page.goto(`${base}/?mode=b1&svg=1&frame=integration&capture=1`);await page.waitForFunction(()=>window.b1?.ready);await page.locator('.b1-foreground').evaluate(im=>im.decode());const integration=await save('checks/svg-1200x800.png',true);assert.equal(png(integration).readUInt32BE(16),1200);assert.equal(png(integration).readUInt32BE(20),800);
 // Baseline rollback still renders exactly the committed V0.8 evidence.
 await page.goto(`${base}/?mode=v08&view=terrain&clouds=0&capture=1`);await page.waitForFunction(()=>window.landscape?.ready);const legacy=await page.evaluate(()=>window.landscape.export('terrain',false));assert.equal(hash(png(legacy)),hash(await fs.readFile('evidence/v08/01-terrain.png')));
 checks.push('1200×800 integration export; V0.8 rollback output is byte-identical to the committed baseline.');assert.deepEqual(errors,[]);
 await fs.writeFile(`${folder}/browser-report.json`,JSON.stringify({phase:'B1',passed:true,artApproval:'PENDING_AUTHOR_REVIEW',checks,lightChange,assets,states,responsive,errors,browser:browser.version(),renderer:'Chromium SwiftShader'},null,2));
 console.log(JSON.stringify({passed:true,checks,lightChange,errors},null,2));
}catch(error){await fs.writeFile(`${folder}/browser-report.json`,JSON.stringify({passed:false,checks,errors,error:String(error)},null,2));throw error;}finally{await browser.close();}
