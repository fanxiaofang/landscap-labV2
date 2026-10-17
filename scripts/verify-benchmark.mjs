import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4180',folder='evidence/v05';
const png=data=>Buffer.from(data.split(',')[1],'base64');
const hash=data=>createHash('sha256').update(data).digest('hex');
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],checks=[];
await fs.mkdir(folder,{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  let formalRequests=0;await page.route('**/reference/live-assets.svg',r=>{formalRequests++;return r.abort();});
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.landscape?.ready);
  assert.equal((await page.evaluate(()=>window.landscape.stats())).benchmark,true);
  assert.equal(await page.locator('.proxy-overlay').count(),0);
  assert.equal(await page.getByRole('button',{name:'Proxy 占位',exact:true}).count(),0);
  assert.equal(await page.getByLabel('静态云海',{exact:true}).isChecked(),false);
  assert.equal(await page.getByLabel('秋季定稿对照',{exact:true}).isChecked(),true);
  assert.equal(hash(await fs.readFile('../references/01_autumn_approved.png.png')),hash(await fs.readFile('public/reference/autumn-approved.png')));
  await page.locator('.reference-image img').evaluate(im=>im.decode());
  await page.locator('.reference-strip img').evaluateAll(ims=>Promise.all(ims.map(im=>im.decode())));
  assert.equal(await page.locator('.reference-strip img').count(),5);
  checks.push('Default benchmark uses all five structure references and the unchanged autumn image, without Proxy or formal assets.');
  const frames={};
  for(const [key,clouds,file] of [['terrain',false,'01-terrain-16x9.png'],['clouds',true,'02-static-clouds-16x9.png']]){
    const data=await page.evaluate(c=>window.landscape.export('terrain',c),clouds);
    assert.equal(data,await page.evaluate(c=>window.landscape.export('terrain',c),clouds));
    const bytes=png(data);assert.equal(bytes.readUInt32BE(16),1600);assert.equal(bytes.readUInt32BE(20),900);
    await fs.writeFile(`${folder}/${file}`,bytes);frames[key]=data;
    assert.equal((await page.evaluate(()=>window.landscape.stats())).clouds,false);
  }
  assert.notEqual(frames.terrain,frames.clouds);
  await page.getByLabel('静态云海',{exact:true}).check();assert.equal(await page.evaluate(()=>window.landscape.export()),frames.clouds);
  await page.getByLabel('静态云海',{exact:true}).uncheck();assert.equal(await page.evaluate(()=>window.landscape.export()),frames.terrain);
  checks.push('Both 1600×900 exports are deterministic; toggling clouds restores the exact original clear terrain and material colours.');
  const comparison=await page.evaluate(async frames=>{
    const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
    const ref=await load('/reference/autumn-approved.png'),clear=await load(frames.terrain),cloud=await load(frames.clouds);
    const c=document.createElement('canvas');c.width=3248;c.height=1960;const ctx=c.getContext('2d');
    ctx.fillStyle='#edf0ec';ctx.fillRect(0,0,c.width,c.height);ctx.font='24px Microsoft YaHei, sans-serif';ctx.fillStyle='#354135';
    const panel=(im,x,y,label)=>{ctx.fillText(label,x,y+33);const scale=Math.min(1600/im.width,900/im.height),w=im.width*scale,h=im.height*scale;ctx.drawImage(im,x+(1600-w)/2,y+50+(900-h)/2,w,h);};
    panel(ref,16,0,'秋季定稿 · 构图与色彩基准');panel(clear,1632,0,'V0.5 · 纯地形 / 检查真实坡脚与谷地');
    panel(ref,16,980,'秋季定稿 · 同尺度 1600 × 900 画框');panel(cloud,1632,980,'V0.5 · 静态云海 / 山群 benchmark · 待审阅');
    return c.toDataURL('image/png');
  },frames);
  await fs.writeFile(`${folder}/03-autumn-comparison.png`,png(comparison));
  for(const mode of ['overlay','wipe']){
    await page.getByLabel('比较方式',{exact:true}).selectOption(mode);await page.locator('.reference-overlay').evaluate(im=>im.decode());
    assert.equal(await page.evaluate(()=>window.landscape.export()),frames.terrain);
  }
  await page.getByLabel('比较方式',{exact:true}).selectOption('side');
  await page.getByLabel('静态云海',{exact:true}).check();
  const downloadWait=page.waitForEvent('download');await page.getByRole('button',{name:'导出截图'}).click();
  const download=await downloadWait;await download.saveAs(`${folder}/button-export.png`);assert.equal(hash(await fs.readFile(`${folder}/button-export.png`)),hash(png(frames.clouds)));
  checks.push('Side-by-side, overlay, wipe and actual PNG export button work without changing the geometry export.');
  await page.screenshot({path:`${folder}/04-benchmark-desktop.png`,fullPage:true});
  const responsive=[];
  for(const width of [1600,1024,768,390]){
    await page.setViewportSize({width,height:1000});
    const sizes=await page.evaluate(()=>{
      const rect=s=>{const b=document.querySelector(s).getBoundingClientRect();return {width:b.width,height:b.height};};
      return {current:rect('.viewport'),reference:rect('.reference-image'),scroll:document.documentElement.scrollWidth};
    });
    assert.deepEqual(sizes.current,sizes.reference);assert.ok(Math.abs(sizes.current.width/sizes.current.height-16/9)<.001);assert.ok(sizes.scroll<=width);
    responsive.push({width,...sizes});
  }
  await page.screenshot({path:`${folder}/05-benchmark-mobile.png`,fullPage:true});
  assert.equal(formalRequests,0);assert.deepEqual(errors,[]);
  checks.push('Both frames remain aligned at 1600, 1024, 768 and 390 px; zero browser errors or formal asset requests.');
  await fs.writeFile(`${folder}/browser-report.json`,JSON.stringify({version:'0.5',passed:true,artApproval:'PENDING_AUTHOR_REVIEW',integrationEnabled:false,browser:browser.version(),renderer:'Chromium SwiftShader',checks,responsive,formalRequests,errors},null,2));
  console.log(JSON.stringify({passed:true,checks,formalRequests,errors},null,2));
} catch(e){await fs.writeFile(`${folder}/browser-report.json`,JSON.stringify({passed:false,checks,errors,error:String(e)},null,2));throw e;}
finally{await browser.close();}
