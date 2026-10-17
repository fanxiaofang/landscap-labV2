import { drawSky, type LandscapeRenderer } from '../world/renderer';
function loadImage(src:string) {return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('无法载入截图合成资源'));img.src=src;});}
export async function exportFrame(engine:LandscapeRenderer,assets:boolean,calibration?:SVGSVGElement|null) {
  engine.render();
  const out=document.createElement('canvas');out.width=1200;out.height=800;
  const ctx=out.getContext('2d');if(!ctx)throw new Error('无法创建截图画布');
  drawSky(ctx);ctx.drawImage(engine.renderer.domElement,0,0);
  if(assets)ctx.drawImage(await loadImage('/reference/live-assets.svg'),0,0,1200,800);
  if(calibration){const text=new XMLSerializer().serializeToString(calibration);const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));try{ctx.drawImage(await loadImage(url),0,0,1200,800);}finally{URL.revokeObjectURL(url);}}
  if(assets){ctx.fillStyle='rgba(250,248,235,.92)';ctx.fillRect(16,764,543,23);ctx.fillStyle='#324032';ctx.font='12px sans-serif';ctx.fillText('V0.1 · 真实 SVG 静态快照合成 · 原始 Overview 位置 / 比例 · 无云海',26,780);}
  return out.toDataURL('image/png');
}
export function downloadUrl(url:string,filename:string) {const a=document.createElement('a');a.href=url;a.download=filename;a.click();}
