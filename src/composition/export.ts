import { type LandscapeRenderer } from '../world/renderer';
import { proxyUrl } from './Proxy';
import type { CompositionView } from './placements';
import { loadAssetComposition } from './assets';
export function loadImage(src:string) {return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('无法载入截图合成资源'));img.src=src;});}
export async function exportFrame(engine:LandscapeRenderer,view:CompositionView,clouds=engine.clouds.visible,calibration?:SVGSVGElement|null) {
  const previous=engine.clouds.visible,previousRiver=engine.river.visible;
  try {
    engine.setClouds(clouds);
    engine.setRiver(view!=='terrain');
    const {width,height}=engine.frame,out=document.createElement('canvas');out.width=width;out.height=height;
    const ctx=out.getContext('2d');if(!ctx)throw new Error('无法创建截图画布');
    // The WebGL frame already includes the opaque autumn sky seen in preview.
    ctx.drawImage(engine.renderer.domElement,0,0);
    if(view==='proxy'&&engine.stats.cameraView==='target')ctx.drawImage(await loadImage(proxyUrl(engine.frame)),0,0,width,height);
    if(view==='assets'&&engine.stats.cameraView==='target')ctx.drawImage(await loadImage((await loadAssetComposition(engine.frame)).url),0,0,width,height);
    if(calibration&&engine.stats.cameraView==='target'){const text=new XMLSerializer().serializeToString(calibration);const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));try{ctx.drawImage(await loadImage(url),0,0,width,height);}finally{URL.revokeObjectURL(url);}}
    return out.toDataURL('image/png');
  }finally{engine.setRiver(previousRiver);engine.setClouds(previous);}
}
export function downloadUrl(url:string,filename:string) {const a=document.createElement('a');a.href=url;a.download=filename;a.click();}
