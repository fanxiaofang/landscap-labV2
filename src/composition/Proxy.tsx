import { groundHeight } from '../terrain/layout';
import { projectPoint } from '../world/projection';
import { SCENE_PLACEMENTS, type ScenePlacement } from './placements';

const q=Math.SQRT1_2;
const number=(value:number)=>value.toFixed(2);
const screen=(u:number,d:number,h:number)=>{const p=projectPoint(u,d,h);return `${number(p.x)},${number(p.y)}`;};
const polygon=(points:string[],fill:string,extra='')=>`<polygon points="${points.join(' ')}" fill="${fill}" ${extra}/>`;
function corners(placement:ScenePlacement,width=placement.footprint.width,depth=placement.footprint.depth,offsetX=0,offsetZ=0) {
  return [[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]].map(([x,z])=>{
    const u=placement.u+(x+offsetX-z-offsetZ)*q;
    const d=placement.d-(x+offsetX+z+offsetZ)*q;
    return {u,d,h:groundHeight(u,d)};
  });
}
function volume(placement:ScenePlacement,width=placement.footprint.width,depth=placement.footprint.depth,height=placement.height,offsetX=0,baseHeight?:number) {
  const vertices=corners(placement,width,depth,offsetX);
  // Walls meet each sampled ground corner; the roof remains horizontal.
  const roof=(baseHeight??Math.max(...vertices.map(p=>p.h)))+height;
  const base=vertices.map(p=>screen(p.u,p.d,baseHeight??p.h));
  const top=vertices.map(p=>screen(p.u,p.d,roof));
  const home=placement.slot==='home';
  return polygon([base[1],base[2],top[2],top[1]],home?'#939a8e':'#8b948a')+
    polygon([base[2],base[3],top[3],top[2]],home?'#aab0a0':'#a1a99a')+
    polygon(top,home?'#e2e2cc':'#c6cebb');
}
function shape(placement:ScenePlacement) {
  const vertices=corners(placement);
  const outline=vertices.map(p=>screen(p.u,p.d,p.h+.6));
  if(placement.kind==='footprint')return polygon(outline,'#d7ddc5','fill-opacity=".26" stroke="#66735d" stroke-width="1.2" stroke-dasharray="4 4"');
  if(placement.kind==='bridge') {
    const deck=Math.max(...vertices.map(p=>p.h))+placement.height;
    const pillars=[-82,0,82].map(x=>volume(placement,14,22,deck-groundHeight(placement.u+x*q,placement.d-x*q),x)).join('');
    const train=[-36,-2,32].map(x=>volume(placement,27,19,14,x,deck+7)).join('');
    return pillars+volume(placement,undefined,undefined,7,0,deck)+train;
  }
  return volume(placement);
}

/** One serialization serves the live overlay and PNG export; no formal artwork is referenced. */
export function proxySvg() {
  const shapes=[...SCENE_PLACEMENTS].sort((a,b)=>b.d-a.d).map(placement=>{
    const vertices=corners(placement);
    const highest=Math.max(...vertices.map(p=>p.h));
    const label=projectPoint(placement.u,placement.d,highest+placement.height+(placement.kind==='bridge'?30:10));
    return `<g data-proxy-slot="${placement.slot}">${shape(placement)}<text x="${number(label.x)}" y="${number(label.y)}" text-anchor="middle" fill="#364439" stroke="#e8edda" stroke-opacity=".9" stroke-width="3" paint-order="stroke" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="${placement.slot==='home'?12:10}">${placement.name}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">${shapes}</svg>`;
}
export function proxyUrl() {return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(proxySvg())}`;}
export function Proxy() {
  return <img className="proxy-overlay" src={proxyUrl()} alt="Proxy 占位布局：主屋、拖拉机、桥与火车、通讯设施及生活辅助区域"/>;
}
