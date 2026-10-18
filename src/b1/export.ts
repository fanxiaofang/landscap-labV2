import {foregroundSvg,svgUrl} from './foreground';
import type {MidFarRenderer} from './renderer';
function loadImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('SVG 合成资源无法载入'));image.src=src;});}
export function downloadUrl(url:string,filename:string){const a=document.createElement('a');a.href=url;a.download=filename;a.click();}
export async function exportB1(engine:MidFarRenderer,foreground=false){
 // Snapshot WebGL and navigation synchronously before awaiting SVG. A concurrent
 // pointer movement cannot mix two different camera states in the same export.
 const navigation={...engine.navigation},target=engine.view==='target';engine.render();
 const out=document.createElement('canvas');out.width=engine.frame.width;out.height=engine.frame.height;
 const ctx=out.getContext('2d')!;ctx.drawImage(engine.renderer.domElement,0,0);
 const svg=foreground&&target?await foregroundSvg(engine.frame,navigation):null;
 const url=svg?svgUrl(svg):null;
 try{
  const image=url?await loadImage(url):null;
  if(image)ctx.drawImage(image,0,0);return out.toDataURL('image/png');
 }finally{if(url)URL.revokeObjectURL(url);}
}
