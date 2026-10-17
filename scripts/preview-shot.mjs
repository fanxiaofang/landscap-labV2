import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
 page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
 await page.goto('http://127.0.0.1:4180/?capture=1&view=terrain');
 await page.waitForFunction(()=>window.landscape?.ready);
 await fs.mkdir('evidence/v03',{recursive:true});
 for(const [mode,file] of [['terrain','01-terrain.png'],['proxy','02-proxy.png'],['composite','03-svg-comparison.png']]){
   const url=await page.evaluate(mode=>window.landscape.export(mode),mode);
   await fs.writeFile(`evidence/v03/${file}`,Buffer.from(url.split(',')[1],'base64'));
 }
 console.log(await page.evaluate(()=>window.landscape.stats()));
}finally{await browser.close();}
