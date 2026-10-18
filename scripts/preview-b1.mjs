import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
await fs.mkdir('.reference-cache/b1',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.on('pageerror',e=>console.error(e.message));
 await page.goto('http://127.0.0.1:4180/?mode=b1');await page.waitForFunction(()=>window.b1?.ready);
 for(const pose of process.argv[2]?[process.argv[2]]:['oblique','top','side','target']){
  await page.evaluate(p=>window.b1.setView(p),pose);await page.waitForFunction(p=>window.b1.stats().view===p,pose);
  const data=await page.evaluate(()=>window.b1.export(false));await fs.writeFile(`.reference-cache/b1/${pose}.png`,Buffer.from(data.split(',')[1],'base64'));
 }
 await page.getByRole('button',{name:'SVG Composite',exact:true}).click();await page.locator('.b1-foreground').evaluate(im=>im.decode());
 const data=await page.evaluate(()=>window.b1.export(true));await fs.writeFile('.reference-cache/b1/composite.png',Buffer.from(data.split(',')[1],'base64'));
 console.log(await page.evaluate(()=>window.b1.stats()));
 await page.screenshot({path:'.reference-cache/b1/desktop.png',fullPage:true});
}finally{await browser.close();}
