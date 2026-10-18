import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>console.error(e.message));
  await page.goto('http://127.0.0.1:4180/?capture=1');
  await page.waitForFunction(()=>window.landscape?.ready);
  await fs.mkdir('.reference-cache/v07',{recursive:true});
  for(const [view,clouds,name] of [['target',false,'terrain'],['oblique',false,'oblique'],['top',false,'top'],['side',false,'side'],['target',true,'clouds']]){
    await page.evaluate(v=>window.landscape.setCameraView(v),view);
    await page.waitForFunction(v=>window.landscape.stats().cameraView===v,view);
    const data=await page.evaluate(c=>window.landscape.export('terrain',c),clouds);
    await fs.writeFile(`.reference-cache/v07/${name}.png`,Buffer.from(data.split(',')[1],'base64'));
  }
  console.log(await page.evaluate(()=>window.landscape.stats()));
}finally {await browser.close();}
