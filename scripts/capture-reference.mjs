import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const out = 'public/reference';
await fs.mkdir(out, { recursive: true });
await fs.mkdir('evidence', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: {width:1200,height:800}, deviceScaleFactor:1 });
  await page.goto('http://127.0.0.1:4178/', {waitUntil:'networkidle'});
  await page.getByRole('button', {name:'黄昏', exact:true}).click();
  if (await page.locator('#panoramic-world-stage').getAttribute('data-room') !== 'overview') throw new Error('Expected real Overview camera');
  await page.waitForTimeout(1600);
  await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
  await page.locator('svg[viewBox="0 0 1200 800"]').evaluate(svg => {svg.pauseAnimations();svg.setCurrentTime(0);});
  await page.screenshot({path:'evidence/live-overview-with-ui.png'});
  const data = await page.locator('svg[viewBox="0 0 1200 800"]').evaluate(svg => {
    const ids = ['yorkshire-railway-viaduct','tractor-in-field','yorkshire-sheep-pen-cluster','cottage-pumpkin-patch','west-cottage-grounds','hilltop-observatory-haven','living-cottage-haven','capsule-pod-cluster','wooden-cabin-cluster','yorkshire-sheep-flock-and-dressing'];
    const props = ['fill','fill-opacity','stroke','stroke-opacity','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','opacity','color','font-family','font-size','font-weight','text-anchor','visibility','display','filter','clip-path','mask','transform','transform-origin','transform-box'];
    const cloneWithStyles = el => {
      const clone=el.cloneNode(true);
      const src=[el,...el.querySelectorAll('*')], dst=[clone,...clone.querySelectorAll('*')];
      src.forEach((node,i)=>{
        const s=getComputedStyle(node);
        for(const p of props) dst[i].style.setProperty(p,s.getPropertyValue(p));
        dst[i].removeAttribute('class');
        dst[i].removeAttribute('tabindex');
        dst[i].removeAttribute('role');
        dst[i].style.animation='none';
        dst[i].style.transition='none';
        // Absolute URL references from computed style must remain local in the saved SVG.
        dst[i].setAttribute('style',dst[i].getAttribute('style').replace(/url\(["']?[^)"']*#([^)'" ]+)["']?\)/g,'url(#$1)'));
      });
      clone.querySelectorAll('animate,animateTransform,animateMotion,set').forEach(el=>el.remove());
      return clone;
    };
    const full=cloneWithStyles(svg);
    full.setAttribute('xmlns','http://www.w3.org/2000/svg');full.setAttribute('width','1200');full.setAttribute('height','800');full.removeAttribute('style');
    const layer=document.createElementNS('http://www.w3.org/2000/svg','svg');
    layer.setAttribute('xmlns','http://www.w3.org/2000/svg');layer.setAttribute('viewBox','0 0 1200 800');layer.setAttribute('width','1200');layer.setAttribute('height','800');layer.setAttribute('preserveAspectRatio','xMidYMid slice');
    const defs=document.createElementNS(layer.namespaceURI,'defs');
    const seen=new Set();
    svg.querySelectorAll('defs > *').forEach(el=>{if(el.id&&!seen.has(el.id)){seen.add(el.id);defs.append(cloneWithStyles(el));}});
    layer.append(defs);
    const anchors=[];
    for(const id of ids){
      const el=svg.querySelector('#'+id);if(!el)throw new Error('Missing true asset: '+id);
      const m=svg.getScreenCTM().inverse().multiply(el.parentElement.getScreenCTM());
      const wrapper=document.createElementNS(layer.namespaceURI,'g');
      wrapper.setAttribute('transform',`matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
      wrapper.setAttribute('data-source-id',id);
      const clone=cloneWithStyles(el);clone.querySelectorAll('defs').forEach(d=>d.remove());wrapper.append(clone);layer.append(wrapper);
      const box=el.getBoundingClientRect();const b=el.getBBox();const c=svg.getScreenCTM().inverse().multiply(el.getScreenCTM());
      anchors.push({id,bounds:{x:box.x,y:box.y,width:box.width,height:box.height},localBounds:{x:b.x,y:b.y,width:b.width,height:b.height},ctm:{a:c.a,b:c.b,c:c.c,d:c.d,e:c.e,f:c.f}});
    }
    const stage=svg.querySelector('#panoramic-world-stage');
    return {full:full.outerHTML,assets:layer.outerHTML,anchors,camera:{room:stage.dataset.room,zoom:Number(stage.dataset.zoom),css:getComputedStyle(stage).transform},nodeCount:svg.querySelectorAll('*').length};
  });
  await fs.writeFile(out+'/live-assets.svg',data.assets);
  await fs.writeFile(out+'/live-overview.svg',data.full);
  const sourceRoot=process.env.LWM_SOURCE;
  if(!sourceRoot) throw new Error('Set LWM_SOURCE to a local Live With Me checkout before capturing references.');
  const tracked=execFileSync('git',['ls-files','-z'],{cwd:sourceRoot,encoding:'utf8'}).split('\0').filter(Boolean);
  const hashes={};
  for(const name of tracked){try{hashes[name]=createHash('sha256').update(await fs.readFile(sourceRoot+'/'+name)).digest('hex');}catch{hashes[name]='missing';}}
  await fs.writeFile('evidence/source-hashes-before.json',JSON.stringify(hashes,null,2));
  const provenance={capturedAt:new Date().toISOString(),source:'Live With Me Overview captured from the running application',sourceState:'Existing working tree, including pre-existing uncommitted source; served read-only',viewport:{width:1200,height:800},mock:false,method:'Live DOM SVG snapshot with resolved paint styles and original ancestor CTMs. CSS animations disabled and SMIL frozen at t=0, animation elements removed from snapshot. No terrain nodes included in asset overlay. No asset positions or geometry changed.',...data,full:undefined,assets:undefined,assetsSha256:createHash('sha256').update(data.assets).digest('hex')};
  await fs.writeFile(out+'/provenance.json',JSON.stringify(provenance,null,2));
  const isolated=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
  await isolated.setContent('<style>body{margin:0}svg{display:block}</style>'+data.full);
  await isolated.screenshot({path:out+'/live-overview.png'});
  console.log(JSON.stringify({camera:data.camera,assets:data.anchors.length,nodeCount:data.nodeCount,anchors:data.anchors.map(a=>({id:a.id,bounds:a.bounds}))},null,2));
} finally {await browser.close();}
