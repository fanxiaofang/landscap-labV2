import {FRAME, frameMapping, type Frame} from '../world/projection';
import {overlayTransform, type Navigation} from './camera';

const NS='http://www.w3.org/2000/svg';
const KEEP=new Set(['panoramic-world-stage','parallax-wheat-layer','railway-valley-placement']);
let source:Promise<string>|undefined;
function original(){return source??=fetch('/reference/live-overview.svg').then(r=>{if(!r.ok)throw new Error('无法读取原始 Live With Me SVG');return r.text();}).catch(e=>{source=undefined;throw e;});}
/** Retain original meadow, house, sheep, facilities, wheat and viaduct artwork.
 * Their geometry, fills, ancestor transforms and ordering stay intact. Only
 * the adapter's placement and a left-field compositing window are new.
 */
export async function foregroundSvg(frame:Frame=FRAME,n:Navigation={x:0,y:0,zoom:1}){
 const doc=new DOMParser().parseFromString(await original(),'image/svg+xml');
 if(doc.querySelector('parsererror'))throw new Error('原始 SVG 解析失败');
 const root=doc.documentElement;
 const prune=(node:Element):boolean=>{
  if(node.tagName==='defs'||KEEP.has(node.id))return true;
  for(const child of [...node.children])if(!prune(child))child.remove();
  return node.children.length>0;
 };
 prune(root);
 const field=root.querySelector('#parallax-wheat-layer');
 // Clip in original projected coordinates, outside the artwork's own transforms.
 // The native meadow covers the near edge. Rightward space belongs to the river.
 if(field){
  const defs=doc.createElementNS(NS,'defs'),clip=doc.createElementNS(NS,'clipPath'),path=doc.createElementNS(NS,'path');
  clip.id='b1-west-field-window';path.setAttribute('d','M-4000 -1000 H160 Q260 290 360 340 Q450 405 720 530 H-4000 Z');clip.append(path);defs.append(clip);root.append(defs);
  const wrapper=doc.createElementNS(NS,'g');wrapper.setAttribute('clip-path','url(#b1-west-field-window)');field.replaceWith(wrapper);wrapper.append(field);
 }
 const map=frameMapping(frame),fit=doc.createElementNS(NS,'g'),composition=doc.createElementNS(NS,'g'),nav=doc.createElementNS(NS,'g');
 // A uniform placement preserves legacy axis slopes. Original meadow extends
 // beyond the snapshot's viewBox, providing actual overscan during navigation.
 composition.setAttribute('transform','translate(170 80) scale(1.05)');
 for(const child of [...root.children])if(child.tagName!=='defs')composition.append(child);
 fit.setAttribute('transform',`translate(0 ${map.offsetY}) scale(${map.scale})`);fit.append(composition);
 nav.setAttribute('transform',overlayTransform(frame,n));nav.append(fit);root.append(nav);
 root.setAttribute('viewBox',`0 0 ${frame.width} ${frame.height}`);root.setAttribute('width',String(frame.width));root.setAttribute('height',String(frame.height));root.setAttribute('preserveAspectRatio','xMidYMid meet');
 return new XMLSerializer().serializeToString(root);
}
export const svgUrl=(svg:string)=>URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
