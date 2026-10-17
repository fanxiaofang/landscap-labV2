import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const provenance=JSON.parse(await fs.readFile('public/reference/provenance.json','utf8'));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:4180/reference/live-assets.svg');
 const result=await page.evaluate(anchors=>anchors.map(a=>{
   const el=document.getElementById(a.id),b=el.getBoundingClientRect(),m=el.getCTM();
   return {id:a.id,matrixError:Math.max(...['a','b','c','d','e','f'].map(k=>Math.abs(m[k]-a.ctm[k]))),boundsError:Object.fromEntries(['x','y','width','height'].map(k=>[k,b[k]-a.bounds[k]]))};
 }),provenance.anchors);
 console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
