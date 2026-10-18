import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>console.error(e.message));
 await page.goto('http://127.0.0.1:4180/?capture=1&camera=oblique');await page.waitForFunction(()=>window.landscape?.ready);
 await fs.mkdir('.reference-cache/v08',{recursive:true});
 for(const view of ['oblique','top','side','target']){
  await page.evaluate(v=>window.landscape.setCameraView(v),view);await page.waitForFunction(v=>window.landscape.stats().cameraView===v,view);
  const data=await page.evaluate(()=>window.landscape.export('terrain',false));
  await fs.writeFile(`.reference-cache/v08/${view}.png`,Buffer.from(data.split(',')[1],'base64'));
 }
 for(const view of ['river','proxy','assets']){
  const data=await page.evaluate(v=>window.landscape.export(v,true),view);
  await fs.writeFile(`.reference-cache/v08/${view}.png`,Buffer.from(data.split(',')[1],'base64'));
 }
 console.log(await page.evaluate(()=>window.landscape.stats()));
}finally{await browser.close();}

