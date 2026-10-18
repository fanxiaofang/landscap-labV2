import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:800}});
 await page.setContent('<style>body{margin:0}</style>'+await fs.readFile('public/reference/live-overview.svg','utf8'));
 console.log(JSON.stringify(await page.evaluate(()=>{
  const ids=['parallax-mountains-layer','parallax-wheat-layer','panoramic-world-stage','homestead-meadow-base','yorkshire-terrain-mass','master-axonometric-ground-plane','homestead-organic-meadow-grounds'];
  return ids.map(id=>{const e=document.getElementById(id);return {id,bounds:e.getBoundingClientRect().toJSON(),children:[...e.children].map(n=>({tag:n.tagName,id:n.id, d:n.getAttribute('d')?.slice(0,180),bounds:n.getBoundingClientRect().toJSON()}))};});
 }),null,2));
}finally{await browser.close();}
