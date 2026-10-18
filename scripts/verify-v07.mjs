import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const base=process.env.PREVIEW_URL||'http://127.0.0.1:4180',folder='evidence/v07';
const png=data=>Buffer.from(data.split(',')[1],'base64');
const hash=data=>createHash('sha256').update(data).digest('hex');
const imageData=bytes=>`data:image/png;base64,${bytes.toString('base64')}`;
const errors=[],checks=[],outputs={},skyChecks=[],views=[];
let formalRequests=0;
await fs.mkdir(`${folder}/checks`,{recursive:true});
const baseline=JSON.parse(await fs.readFile(`${folder}/baseline/manifest.json`,'utf8'));
const before={};
for(const [key,file] of [['terrain','v06-terrain.png'],['clouds','v06-clouds.png']]){
  const bytes=await fs.readFile(`${folder}/baseline/${file}`);
  assert.equal(hash(bytes),baseline.hashes[file]);before[key]=imageData(bytes);
}
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/reference/live-assets.svg',r=>{formalRequests++;return r.abort();});
  await page.goto(base);await page.waitForFunction(()=>window.landscape?.ready);
  const stats=await page.evaluate(()=>window.landscape.stats()),targetMatrix=stats.targetCameraMatrix;
  assert.equal(stats.cameraView,'target');assert.equal(stats.benchmark,true);
  assert.equal(await page.locator('.proxy-overlay').count(),0);
  assert.equal(await page.getByLabel('静态云海',{exact:true}).isChecked(),false);
  assert.equal(await page.locator('.reference-strip img').count(),5);
  await page.locator('.reference-image img').evaluate(im=>im.decode());
  await page.locator('.reference-strip img').evaluateAll(ims=>Promise.all(ims.map(im=>im.decode())));

  for(const [key,clouds,file] of [['terrain',false,'01-terrain-target.png'],['clouds',true,'03-static-cloud-placeholder.png']]){
    const data=await page.evaluate(c=>window.landscape.export('terrain',c),clouds);
    assert.equal(data,await page.evaluate(c=>window.landscape.export('terrain',c),clouds));
    const bytes=png(data);assert.equal(bytes.readUInt32BE(16),1600);assert.equal(bytes.readUInt32BE(20),900);
    outputs[key]=data;await fs.writeFile(`${folder}/${file}`,bytes);
    assert.equal((await page.evaluate(()=>window.landscape.stats())).clouds,false);
  }
  assert.notEqual(outputs.terrain,outputs.clouds);
  checks.push('Both target exports are deterministic 1600×900 PNGs; cloud export restores the prior cloud state.');
  for(const pose of ['oblique','top','side']){
    await page.getByLabel('检查视角',{exact:true}).selectOption(pose);
    await page.waitForFunction(v=>window.landscape.stats().cameraView===v,pose);
    const data=await page.evaluate(()=>window.landscape.export('terrain',false));
    assert.notEqual(data,outputs.terrain);assert.equal(data,await page.evaluate(()=>window.landscape.export('terrain',false)));
    assert.deepEqual((await page.evaluate(()=>window.landscape.stats())).targetCameraMatrix,targetMatrix);
    await fs.writeFile(`${folder}/${pose==='oblique'?'02-free-inspection.png':`checks/${pose}.png`}`,png(data));
    views.push({pose,matrix:(await page.evaluate(()=>window.landscape.stats())).inspectionCameraMatrix});
  }
  // Exercise real pointer rotation, pan and zoom, not only preset API calls.
  await page.getByLabel('检查视角',{exact:true}).selectOption('oblique');
  const canvas=page.locator('.viewport canvas');
  const rect=await canvas.boundingBox(),x=rect.x+rect.width*.5,y=rect.y+rect.height*.5;
  const originalMatrix=(await page.evaluate(()=>window.landscape.stats())).inspectionCameraMatrix;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+80,y+35,{steps:8});await page.mouse.up();
  assert.notDeepEqual((await page.evaluate(()=>window.landscape.stats())).inspectionCameraMatrix,originalMatrix);
  const rotated=await page.evaluate(()=>window.landscape.export());
  await page.mouse.move(x,y);await page.mouse.wheel(0,-160);
  await page.waitForTimeout(120);
  assert.notEqual(await page.evaluate(()=>window.landscape.export()),rotated);
  const zoomed=await page.evaluate(()=>window.landscape.export());
  await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+55,y,{steps:8});await page.mouse.up({button:'right'});
  assert.notEqual(await page.evaluate(()=>window.landscape.export()),zoomed);
  await page.getByLabel('检查视角',{exact:true}).selectOption('target');
  assert.equal(await page.evaluate(()=>window.landscape.export()),outputs.terrain);
  assert.deepEqual((await page.evaluate(()=>window.landscape.stats())).targetCameraMatrix,targetMatrix);
  checks.push('Oblique, top and side presets, real pointer orbit/pan/zoom, and exact target camera/material restoration pass.');

  await page.getByLabel('静态云海',{exact:true}).check();
  assert.equal(await page.evaluate(()=>window.landscape.export()),outputs.clouds);
  await page.getByLabel('静态云海',{exact:true}).uncheck();
  await page.getByLabel('线框',{exact:true}).check();
  await page.getByLabel('检查视角',{exact:true}).selectOption('oblique');
  await page.getByLabel('线框',{exact:true}).uncheck();
  await page.getByLabel('检查视角',{exact:true}).selectOption('target');
  assert.equal(await page.evaluate(()=>window.landscape.export()),outputs.terrain);
  for(const mode of ['overlay','wipe','side']){
    await page.getByLabel('比较方式',{exact:true}).selectOption(mode);
    assert.equal(await page.evaluate(()=>window.landscape.export()),outputs.terrain);
  }
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出截图'}).click();
  const download=await pending;assert.ok(download.suggestedFilename().startsWith('landscape-v07-target'));
  await download.saveAs(`${folder}/checks/button-export.png`);
  assert.equal(hash(await fs.readFile(`${folder}/checks/button-export.png`)),hash(png(outputs.terrain)));
  checks.push('Cloud, wireframe, comparison modes and actual export button preserve target colours and projection.');

  const comparison=await page.evaluate(async ({before,after})=>{
    const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
    const [a,b,c,d,ref]=await Promise.all([load(before.terrain),load(after.terrain),load(before.clouds),load(after.clouds),load('/reference/autumn-approved.png')]);
    const out=document.createElement('canvas');out.width=1600;out.height=900;const ctx=out.getContext('2d');
    ctx.fillStyle='#edf0ec';ctx.fillRect(0,0,1600,900);ctx.fillStyle='#28372d';
    ctx.font='28px Microsoft YaHei, sans-serif';ctx.fillText('Terrain Foundation · 三方构图对照',28,46);
    ctx.font='16px Microsoft YaHei, sans-serif';ctx.fillStyle='#526153';ctx.fillText('同一目标正交相机 · 完整画幅等比缩放 · V0.7 待人工美术验收',28,76);
    const w=500,h=281.25,xs=[28,550,1072];
    const panel=(im,x,y)=>{ctx.fillStyle='#e1e6de';ctx.fillRect(x,y,w,h);const scale=Math.min(w/im.width,h/im.height);ctx.drawImage(im,x+(w-im.width*scale)/2,y+(h-im.height*scale)/2,im.width*scale,im.height*scale);};
    ctx.fillStyle='#28372d';ctx.font='20px Microsoft YaHei, sans-serif';
    ['V0.6 · 原始基线','V0.7 · 草甸、山肩与谷地','秋季定稿 · 最高美术基准'].forEach((t,i)=>ctx.fillText(t,xs[i],117));
    [a,b,ref].forEach((im,i)=>panel(im,xs[i],134));
    ctx.font='15px Microsoft YaHei, sans-serif';ctx.fillStyle='#526153';
    ctx.fillText('无云海：直接比较地形轮廓、坡肩和谷地',28,447);
    [c,d,ref].forEach((im,i)=>panel(im,xs[i],474));
    ctx.fillStyle='#526153';ctx.fillText('静态云海占位：云实现冻结，仅观察露峰关系；定稿中的植被、资产与云表现尚未接入。',28,787);
    ctx.fillText('V0.7：草甸局部谷口 / 共享连续地表 / 逐组重设计山脊 / 降低极远山屏障',28,826);
    ctx.fillText('未解决：前景起伏与峰群节奏仍需美术判断；静态云海仍偏厚，部分低肩被覆盖。',28,860);
    return out.toDataURL('image/png');
  },{before,after:outputs});
  await fs.writeFile(`${folder}/04-v06-v07-autumn-comparison.png`,png(comparison));

  await page.screenshot({path:`${folder}/checks/desktop.png`,fullPage:true});
  const responsive=[];
  for(const width of [1600,1024,768,390]){
    await page.setViewportSize({width,height:1000});
    const sizes=await page.evaluate(()=>{const rect=s=>{const b=document.querySelector(s).getBoundingClientRect();return {width:b.width,height:b.height};};return {current:rect('.viewport'),reference:rect('.reference-image'),scroll:document.documentElement.scrollWidth};});
    assert.deepEqual(sizes.current,sizes.reference);assert.ok(Math.abs(sizes.current.width/sizes.current.height-16/9)<.001);assert.ok(sizes.scroll<=width);
    responsive.push({width,...sizes});
  }

  await page.setViewportSize({width:1600,height:900});
  await page.goto(`${base}/?capture=1&clouds=0`);await page.waitForFunction(()=>window.landscape?.ready);
  for(const cloud of [false,true]){
    await page.evaluate(c=>window.landscape.setClouds(c),cloud);
    await page.waitForFunction(c=>window.landscape.stats().clouds===c,cloud);
    const screenshot=await page.locator('.viewport canvas').screenshot();
    const samples=await page.evaluate(async ({before,exported,screenshot})=>{
      const load=src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.src=src;});
      const [a,b,c]=await Promise.all([load(before),load(exported),load(screenshot)]);
      const read=im=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return ctx;};
      const contexts=[read(a),read(b),read(c),read(document.querySelector('.viewport canvas'))];
      return [[20,20],[800,40],[1400,100],[800,160]].map(([x,y])=>({x,y,pixels:contexts.map(ctx=>[...ctx.getImageData(x,y,1,1).data])}));
    },{before:before.terrain,exported:outputs[cloud?'clouds':'terrain'],screenshot:imageData(screenshot)});
    for(const sample of samples)for(const pixel of sample.pixels){assert.equal(pixel[3],255);for(let i=0;i<3;i++)assert.ok(Math.abs(pixel[i]-sample.pixels[0][i])<=2);}
    skyChecks.push({cloud,samples});
  }
  await page.goto(`${base}/?study=layout&view=proxy&frame=integration&capture=1`);await page.waitForFunction(()=>window.landscape?.ready);
  const compatibility=await page.evaluate(()=>window.landscape.export('proxy',false));
  assert.equal(png(compatibility).readUInt32BE(16),1200);assert.equal(png(compatibility).readUInt32BE(20),800);
  await fs.writeFile(`${folder}/checks/integration-1200x800.png`,png(compatibility));
  checks.push('V0.6 sky pixels match raw canvas, screenshot and both exports. 1200×800 Proxy compatibility renders without formal SVG.');
  assert.equal(formalRequests,0);assert.deepEqual(errors,[]);
  await fs.writeFile(`${folder}/browser-report.json`,JSON.stringify({version:'0.7',passed:true,artApproval:'PENDING_AUTHOR_REVIEW',integrationEnabled:false,browser:browser.version(),renderer:'Chromium SwiftShader',checks,views,skyChecks,responsive,formalRequests,errors},null,2));
  console.log(JSON.stringify({passed:true,checks,formalRequests,errors},null,2));
}catch(error){await fs.writeFile(`${folder}/browser-report.json`,JSON.stringify({passed:false,checks,errors,error:String(error)},null,2));throw error;}
finally {await browser.close();}
