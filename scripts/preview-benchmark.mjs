import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
 page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:4180/');
 await page.waitForFunction(()=>window.landscape?.ready,{},{timeout:90000});
 await fs.mkdir('evidence/v05',{recursive:true});
 for(const [cloud,file] of [[false,'01-terrain-16x9.png'],[true,'02-static-clouds-16x9.png']]){
   const url=await page.evaluate(cloud=>window.landscape.export('terrain',cloud),cloud);
   await fs.writeFile(`evidence/v05/${file}`,Buffer.from(url.split(',')[1],'base64'));
 }
 console.log(await page.evaluate(()=>window.landscape.stats()));
}finally{await browser.close();}
