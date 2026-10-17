import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
 page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
 await page.goto('http://127.0.0.1:4180/?capture=1');
 await page.waitForFunction(()=>window.landscape?.ready);
 await page.locator('img.asset-overlay').evaluate(img=>img.decode());
 for(const assets of [false,true]){
   const url=await page.evaluate(assets=>window.landscape.export(assets),assets);
   await fs.writeFile(`evidence/${assets?'composite':'terrain'}-preview.png`,Buffer.from(url.split(',')[1],'base64'));
 }
 console.log(await page.evaluate(()=>window.landscape.stats()));
}finally{await browser.close();}
