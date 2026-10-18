import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const folder='evidence/v07/baseline';
await fs.mkdir(folder,{recursive:true});
// Never silently replace the pre-edit evidence when rerunning capture scripts.
if(await fs.stat(`${folder}/manifest.json`).catch(()=>null))throw new Error('V0.6 baseline already captured');
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:4180/?capture=1');
  await page.waitForFunction(()=>window.landscape?.ready);
  const hashes={};
  for(const [clouds,name] of [[false,'v06-terrain.png'],[true,'v06-clouds.png']]){
    const data=await page.evaluate(c=>window.landscape.export('terrain',c),clouds);
    const bytes=Buffer.from(data.split(',')[1],'base64');
    await fs.writeFile(`${folder}/${name}`,bytes);
    hashes[name]=createHash('sha256').update(bytes).digest('hex');
  }
  for(const file of ['src/terrain/layout.ts','src/terrain/ridgeSurface.ts','src/terrain/geometry.ts','src/world/projection.ts','src/world/renderer.ts','src/world/environment.ts','src/world/cloudField.ts','src/world/cloudSea.ts']){
    hashes[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
  }
  await fs.writeFile(`${folder}/manifest.json`,JSON.stringify({version:'0.6',commit:'9c2a5c1',frame:{width:1600,height:900},hashes},null,2));
  console.log('Saved V0.6 clear/cloud baselines and source hashes.');
} finally {await browser.close();}
