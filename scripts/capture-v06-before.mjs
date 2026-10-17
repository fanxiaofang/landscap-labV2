import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder='.reference-cache/v06';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:4180/?capture=1&clouds=1');await page.waitForFunction(()=>window.landscape?.ready);
 const data=await page.evaluate(()=>window.landscape.export('terrain',true));
 const bytes=Buffer.from(data.split(',')[1],'base64');await fs.writeFile(`${folder}/before.png`,bytes);
 const rawSky=await page.locator('.viewport canvas').evaluate(canvas=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0);return [...ctx.getImageData(800,40,1,1).data];});
 const files=['src/world/projection.ts','src/terrain/ridgeSurface.ts','src/terrain/geometry.ts','src/terrain/layout.ts','src/world/cloudField.ts'];
 const hashes={};for(const f of files)hashes[f]=createHash('sha256').update(await fs.readFile(f)).digest('hex');
 const manifest={frame:{width:1600,height:900},url:page.url(),beforeSha256:createHash('sha256').update(bytes).digest('hex'),rawSky,hashes};
 await fs.writeFile(`${folder}/baseline.json`,JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
}finally{await browser.close();}
