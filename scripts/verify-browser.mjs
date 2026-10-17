import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const base=process.env.PREVIEW_URL||'http://127.0.0.1:4180';
await fs.mkdir('evidence/v03',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],checks=[];
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const pngSize=buffer=>({width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1150},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const formalRequests=[];
  page.on('request',request=>{if(request.url().endsWith('/reference/live-assets.svg'))formalRequests.push(request.url());});
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.landscape?.ready);
  assert.equal(await page.evaluate(()=>window.landscape.view()),'terrain');
  assert.equal(formalRequests.length,0);
  const exports={};
  for(const [mode,label,file] of [['terrain','纯地形','01-terrain.png'],['proxy','Proxy 占位','02-proxy.png'],['composite','SVG 对照','03-svg-comparison.png']]){
    await page.getByRole('button',{name:label,exact:true}).click();
    assert.equal(await page.locator('.viewport').getAttribute('data-view'),mode);
    assert.equal(new URL(page.url()).searchParams.get('view'),mode);
    if(mode==='proxy')await page.locator('.proxy-overlay').evaluate(img=>img.decode());
    if(mode==='composite')await page.locator('.asset-overlay').evaluate(img=>img.decode());
    const data=await page.evaluate(()=>window.landscape.export());
    exports[mode]=data;
    assert.equal(data,await page.evaluate(mode=>window.landscape.export(mode),mode));
    const buffer=Buffer.from(data.split(',')[1],'base64');
    assert.deepEqual(pngSize(buffer),{width:1200,height:800});
    await fs.writeFile('evidence/v03/'+file,buffer);
    checks.push({name:file,size:pngSize(buffer),sha256:hash(buffer),deterministic:true});
    if(mode!=='composite')assert.equal(formalRequests.length,0);
  }
  assert.equal(formalRequests.length,1);
  assert.notEqual(exports.terrain,exports.proxy);assert.notEqual(exports.proxy,exports.composite);
  assert.equal(await page.evaluate(()=>window.landscape.export(false)),exports.terrain);
  assert.equal(await page.evaluate(()=>window.landscape.export(true)),exports.composite);
  await fs.writeFile('evidence/01-terrain-no-clouds.png',Buffer.from(exports.terrain.split(',')[1],'base64'));
  await fs.writeFile('evidence/02-real-assets-composite.png',Buffer.from(exports.composite.split(',')[1],'base64'));
  checks.push({name:'all modes export distinct frames; SVG loads only for comparison; boolean export remains compatible',passed:true});
  // A fresh page with the formal asset endpoint unavailable must still render both study modes.
  const independent=await browser.newPage();let blockedRequests=0;
  await independent.route('**/reference/live-assets.svg',route=>{blockedRequests++;return route.abort();});
  await independent.goto(base+'/?view=terrain');
  await independent.waitForFunction(()=>window.landscape?.ready);
  assert.equal(await independent.evaluate(()=>window.landscape.export('terrain')),exports.terrain);
  await independent.getByRole('button',{name:'Proxy 占位',exact:true}).click();
  await independent.locator('.proxy-overlay').evaluate(img=>img.decode());
  assert.equal(await independent.evaluate(()=>window.landscape.export('proxy')),exports.proxy);
  assert.equal(blockedRequests,0);
  assert.equal(await independent.locator('.asset-overlay').count(),0);
  await independent.close();
  checks.push({name:'terrain and Proxy render/export with formal SVG endpoint blocked, without requesting it',passed:true});
  await page.getByRole('button',{name:'Proxy 占位',exact:true}).click();
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出截图'}).click();
  const download=await downloading;
  await download.saveAs('evidence/v03/button-export.png');
  assert.equal(hash(await fs.readFile('evidence/v03/button-export.png')),hash(Buffer.from(exports.proxy.split(',')[1],'base64')));
  checks.push({name:'actual screenshot button download',passed:true});
  await page.getByLabel('投影校准',{exact:true}).check();
  const calibration=await page.evaluate(()=>new XMLSerializer().serializeToString(document.querySelector('svg.calibration')));
  assert.ok(calibration.includes('16.445'));
  await page.locator('.viewport').screenshot({path:'evidence/v03/projection-calibration.png'});
  await page.getByLabel('投影校准',{exact:true}).uncheck();
  await page.getByLabel('线框',{exact:true}).check();
  assert.equal((await page.evaluate(()=>window.landscape.stats())).wireframe,true);
  await page.getByLabel('线框',{exact:true}).uncheck();
  assert.equal((await page.evaluate(()=>window.landscape.stats())).wireframe,false);
  checks.push({name:'calibration and wireframe controls',passed:true});
  await page.screenshot({path:'evidence/v03/04-desktop-review.png',fullPage:true});
  await page.getByLabel('参考对照',{exact:true}).check();
  await page.locator('#reference').selectOption('winter-counterpart.png');
  assert.equal(await page.evaluate(()=>window.landscape.export('terrain')),exports.terrain);
  assert.equal(await page.evaluate(()=>window.landscape.view()),'proxy');
  await page.getByRole('button',{name:'纯地形',exact:true}).click();
  await page.locator('#reference').selectOption('v02-terrain.png');
  await page.locator('.reference-image img').evaluate(img=>img.decode());
  const compareBounds=await page.evaluate(()=>{
    const current=document.querySelector('.viewport').getBoundingClientRect(),reference=document.querySelector('.reference-image').getBoundingClientRect();
    return {current:{y:current.y,width:current.width,height:current.height},reference:{y:reference.y,width:reference.width,height:reference.height}};
  });
  assert.deepEqual(compareBounds.current,compareBounds.reference);
  await page.screenshot({path:'evidence/v03/05-before-after.png',fullPage:true});
  await page.getByLabel('参考对照',{exact:true}).uncheck();
  checks.push({name:'reference selection does not change study mode, terrain or season',passed:true});
  const responsive=[];
  for(const [mode,label] of [['proxy','Proxy 占位'],['composite','SVG 对照']])for(const width of [1440,1024,768,390]){
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.setViewportSize({width,height:900});
    const metrics=await page.evaluate(mode=>{
      const rect=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
      return {viewport:rect(document.querySelector('.viewport')),canvas:rect(document.querySelector('canvas')),overlay:rect(document.querySelector(mode==='proxy'?'.proxy-overlay':'.asset-overlay')),scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
    },mode);
    assert.ok(Math.abs(metrics.viewport.width/metrics.viewport.height-1.5)<.001);
    assert.deepEqual(metrics.canvas,metrics.overlay);
    assert.ok(metrics.scrollWidth<=width);
    responsive.push({mode,...metrics});
  }
  await page.getByRole('button',{name:'Proxy 占位',exact:true}).click();
  await page.screenshot({path:'evidence/v03/06-mobile-review.png',fullPage:true});
  checks.push({name:'responsive layout and synchronized overlays/Canvas bounds',passed:true,sizes:responsive});

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
  assert.ok(maxMatrixError<.001,`Asset CTM changed by ${maxMatrixError}`);
  assert.ok(maxBoundsError<1,`Asset bounds changed by ${maxBoundsError}px`);
  checks.push({name:'real SVG snapshot matches live source placement',mock:false,passed:true,maxMatrixError,maxBoundsError,boundsTolerancePx:1,note:'Transforms are checked separately at 0.001 tolerance. The observatory has a recorded subpixel bounds difference after SVG isolation; this is not a pixel-identical full-scene claim.',alignment});
  // The immutable source is verified above. The delivered composition intentionally relocates it.
  const source=await fs.readFile('public/reference/live-assets.svg','utf8');
  const repositorySource=execFileSync('git',['show','HEAD:public/reference/live-assets.svg'],{encoding:'utf8',maxBuffer:20*1024*1024});
  const normalize=text=>text.replace(/\r\n/g,'\n');
  assert.equal(hash(Buffer.from(normalize(source))),hash(Buffer.from(normalize(repositorySource))));
  const sourcePreservation={matchesCommittedSource:true,normalizedSha256:hash(Buffer.from(normalize(source))),historicalCaptureSha256:provenance.assetsSha256,historicalCaptureHashMatches:hash(Buffer.from(source))===provenance.assetsSha256,note:'The historical provenance checksum already differs from the committed snapshot. Preservation is checked against Git HEAD with line endings normalized, plus subtree equality below.'};
  const placements=await page.evaluate(()=>window.landscape.assets());
  const relocatedSvg=await page.evaluate(()=>window.landscape.assetSvg());
  await assetPage.goto('about:blank');
  await assetPage.setContent('<style>body{margin:0}svg{display:block}</style>'+relocatedSvg);
  const relocated=await assetPage.evaluate(({placements,source})=>{
    const original=new DOMParser().parseFromString(source,'image/svg+xml');
    return placements.map(p=>{
      const element=document.getElementById(p.id),m=element.getCTM(),b=element.getBoundingClientRect();
      const sourceGroup=original.querySelector(`[data-source-id="${p.id}"]`);
      const movedGroup=document.querySelector(`[data-source-id="${p.id}"]`);
      return {id:p.id,sourceGeometryUnchanged:sourceGroup.isEqualNode(movedGroup),ctm:{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f},bounds:{x:b.x,y:b.y,width:b.width,height:b.height},visible:b.right>0&&b.left<1200&&b.bottom>0&&b.top<800};
    });
  },{placements,source});
  assert.equal(relocated.length,10);
  const relocationReport=relocated.map(m=>{
    const p=placements.find(p=>p.id===m.id),original=provenance.anchors.find(a=>a.id===m.id);
    const expected={a:original.ctm.a*p.scale,b:original.ctm.b*p.scale,c:original.ctm.c*p.scale,d:original.ctm.d*p.scale,e:original.ctm.e*p.scale+p.dx,f:original.ctm.f*p.scale+p.dy};
    const matrixError=Math.max(...Object.keys(expected).map(k=>Math.abs(expected[k]-m.ctm[k])));
    assert.ok(matrixError<.001,`${m.id} relocation matrix error ${matrixError}`);
    assert.ok(m.visible,`${m.id} disappeared from frame`);
    assert.ok(m.sourceGeometryUnchanged,`${m.id} original geometry was modified`);
    return {...p,...m,matrixError,expected};
  });
  const house=relocationReport.find(p=>p.id==='living-cottage-haven');
  assert.equal(house.scale,1);
  assert.ok(Math.abs(house.bounds.width-422.4)<1);
  await fs.writeFile('evidence/asset-placement.json',JSON.stringify({version:'0.3',sourcePreservation,passed:true,assets:relocationReport},null,2));
  checks.push({name:'all ten original SVG groups preserved, placed on terrain and visible; house retains original size',passed:true,maxMatrixError:Math.max(...relocationReport.map(p=>p.matrixError))});
  const stats=await page.evaluate(()=>window.landscape.stats());
  assert.equal(errors.length,0,errors.join('\n'));
  const report={version:'0.3',passed:true,url:base,browser:browser.version(),renderer:'Chromium WebGL / SwiftShader software renderer, not a hardware performance benchmark',consoleErrors:errors,stats,checks,artApproval:'PENDING REVIEW. Engineering checks do not assert artistic acceptance.'};
  await fs.writeFile('evidence/browser-report.json',JSON.stringify(report,null,2));
  await fs.writeFile('evidence/v03/browser-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:true,consoleErrors:errors,stats,maxMatrixError,maxBoundsError,checks:checks.length},null,2));
} catch(error) {
  await fs.writeFile('evidence/browser-report.json',JSON.stringify({passed:false,consoleErrors:errors,checks,error:String(error)},null,2));
  throw error;
} finally {await browser.close();}
