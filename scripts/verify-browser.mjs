import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base=process.env.PREVIEW_URL||'http://127.0.0.1:4180';
await fs.mkdir('evidence',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],checks=[];
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const pngSize=buffer=>({width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1150},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.landscape?.ready);
  await page.locator('.asset-overlay').evaluate(img=>img.decode());
  await page.getByRole('button',{name:'真实资产合成',exact:true}).click();
  for(const assets of [false,true]){
    const data=await page.evaluate(assets=>window.landscape.export(assets),assets);
    const buffer=Buffer.from(data.split(',')[1],'base64');
    assert.deepEqual(pngSize(buffer),{width:1200,height:800});
    const name=assets?'02-real-assets-composite.png':'01-terrain-no-clouds.png';
    await fs.writeFile('evidence/'+name,buffer);
    checks.push({name,size:pngSize(buffer),sha256:hash(buffer)});
  }
  const a=await page.evaluate(()=>window.landscape.export(false)),b=await page.evaluate(()=>window.landscape.export(false));
  assert.equal(a,b);checks.push({name:'deterministic export',passed:true});
  const compositeA=await page.evaluate(()=>window.landscape.export(true)),compositeB=await page.evaluate(()=>window.landscape.export(true));
  assert.equal(compositeA,compositeB);checks.push({name:'static SVG composite deterministic export',passed:true});
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出截图'}).click();
  const download=await downloading;
  await download.saveAs('evidence/03-button-export.png');
  assert.deepEqual(pngSize(await fs.readFile('evidence/03-button-export.png')),{width:1200,height:800});
  checks.push({name:'actual screenshot button download',passed:true});
  await page.getByLabel('投影校准',{exact:true}).check();
  const calibration=await page.evaluate(()=>new XMLSerializer().serializeToString(document.querySelector('svg.calibration')));
  assert.ok(calibration.includes('16.445'));
  await page.locator('.viewport').screenshot({path:'evidence/04-projection-calibration.png'});
  await page.getByLabel('投影校准',{exact:true}).uncheck();
  await page.getByLabel('线框',{exact:true}).check();
  assert.equal((await page.evaluate(()=>window.landscape.stats())).wireframe,true);
  await page.getByLabel('线框',{exact:true}).uncheck();
  assert.equal((await page.evaluate(()=>window.landscape.stats())).wireframe,false);
  checks.push({name:'calibration and wireframe controls',passed:true});
  await page.screenshot({path:'evidence/05-desktop-review.png',fullPage:true});
  await page.getByRole('button',{name:'参考对照',exact:true}).click();
  await page.locator('#reference').selectOption('winter-counterpart.png');
  assert.equal(await page.evaluate(()=>window.landscape.export(false)),a);
  await page.locator('#reference').selectOption('autumn-approved.png');
  await page.locator('.reference-image img').evaluate(img=>img.decode());
  await page.screenshot({path:'evidence/06-autumn-comparison.png',fullPage:true});
  checks.push({name:'reference selection never changes terrain or season',passed:true});
  const responsive=[];
  for(const width of [1440,1024,768,390]){
    await page.getByRole('button',{name:'真实资产合成',exact:true}).click();
    await page.setViewportSize({width,height:900});
    const metrics=await page.evaluate(()=>{
      const rect=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
      return {viewport:rect(document.querySelector('.viewport')),canvas:rect(document.querySelector('canvas')),assets:rect(document.querySelector('.asset-overlay')),scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
    });
    assert.ok(Math.abs(metrics.viewport.width/metrics.viewport.height-1.5)<.001);
    assert.deepEqual(metrics.canvas,metrics.assets);
    assert.ok(metrics.scrollWidth<=width);
    responsive.push({width,...metrics});
  }
  await page.screenshot({path:'evidence/07-mobile-review.png',fullPage:true});
  checks.push({name:'responsive layout and synchronized SVG/Canvas bounds',passed:true,sizes:responsive});

  // Re-open the actual preserved SVG, then compare its CTMs and bounds to live DOM provenance.
  const provenance=JSON.parse(await fs.readFile('public/reference/provenance.json','utf8'));
  const assetPage=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
  await assetPage.goto(base+'/reference/live-assets.svg');
  const measured=await assetPage.evaluate(ids=>ids.map(id=>{
    const el=document.getElementById(id),m=el.getCTM(),b=el.getBoundingClientRect();
    return {id,ctm:{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f},bounds:{x:b.x,y:b.y,width:b.width,height:b.height}};
  }),provenance.anchors.map(a=>a.id));
  let maxMatrixError=0,maxBoundsError=0;
  const alignment=measured.map(m=>{
    const original=provenance.anchors.find(a=>a.id===m.id);
    const matrixError=Math.max(...Object.keys(m.ctm).map(k=>Math.abs(m.ctm[k]-original.ctm[k])));
    const boundsError=Math.max(...Object.keys(m.bounds).map(k=>Math.abs(m.bounds[k]-original.bounds[k])));
    maxMatrixError=Math.max(maxMatrixError,matrixError);maxBoundsError=Math.max(maxBoundsError,boundsError);
    return {id:m.id,matrixError,boundsError};
  });
  await fs.writeFile('evidence/asset-alignment.json',JSON.stringify({maxMatrixError,maxBoundsError,alignment},null,2));
  console.log(JSON.stringify({maxMatrixError,maxBoundsError,alignment},null,2));
  assert.ok(maxMatrixError<.001,`Asset CTM changed by ${maxMatrixError}`);
  assert.ok(maxBoundsError<1,`Asset bounds changed by ${maxBoundsError}px`);
  checks.push({name:'real SVG snapshot matches live source placement',mock:false,passed:true,maxMatrixError,maxBoundsError,boundsTolerancePx:1,note:'Transforms are checked separately at 0.001 tolerance. The observatory has a recorded subpixel bounds difference after SVG isolation; this is not a pixel-identical full-scene claim.',alignment});
  const stats=await page.evaluate(()=>window.landscape.stats());
  assert.equal(errors.length,0,errors.join('\n'));
  const report={passed:true,url:base,browser:browser.version(),renderer:'Chromium WebGL / SwiftShader software renderer, not a hardware performance benchmark',consoleErrors:errors,stats,checks,artApproval:'NOT PASSED. Engineering checks do not assert artistic acceptance.'};
  await fs.writeFile('evidence/browser-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:true,consoleErrors:errors,stats,maxMatrixError,maxBoundsError,checks:checks.length},null,2));
} catch(error) {
  await fs.writeFile('evidence/browser-report.json',JSON.stringify({passed:false,consoleErrors:errors,checks,error:String(error)},null,2));
  throw error;
} finally {await browser.close();}
