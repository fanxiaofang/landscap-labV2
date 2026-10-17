import { drawSky, type LandscapeRenderer } from '../world/renderer';
import { loadAssetComposition } from './assets';
import { proxyUrl } from './Proxy';
import type { CompositionView } from './placements';
function loadImage(src:string) {return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('无法载入截图合成资源'));img.src=src;});}
export async function exportFrame(engine:LandscapeRenderer,view:CompositionView|boolean,calibration?:SVGSVGElement|null) {
  const mode=typeof view==='boolean'?(view?'composite':'terrain'):view;
  engine.render();
  const out=document.createElement('canvas');out.width=1200;out.height=800;
  const ctx=out.getContext('2d');if(!ctx)throw new Error('无法创建截图画布');
  drawSky(ctx);ctx.drawImage(engine.renderer.domElement,0,0);
  if(mode==='proxy')ctx.drawImage(await loadImage(proxyUrl()),0,0,1200,800);
  if(mode==='composite')ctx.drawImage(await loadImage((await loadAssetComposition()).url),0,0,1200,800);
  if(calibration){const text=new XMLSerializer().serializeToString(calibration);const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));try{ctx.drawImage(await loadImage(url),0,0,1200,800);}finally{URL.revokeObjectURL(url);}}
  return out.toDataURL('image/png');
}
export function downloadUrl(url:string,filename:string) {const a=document.createElement('a');a.href=url;a.download=filename;a.click();}
