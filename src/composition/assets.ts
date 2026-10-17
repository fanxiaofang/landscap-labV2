import { sceneLayout, SCENE_PLACEMENTS, type SceneSlot } from './placements';

export interface AssetPlacement {
  slot: SceneSlot;
  id: string;
  name: string;
  /** Ground contact in the original, already projected SVG snapshot. */
  source: [number, number];
  u: number;
  d: number;
  scale: number;
}

// Source-specific feet and scale live only in this adapter. Original group geometry is immutable.
const SOURCE_ASSETS: {slot:SceneSlot;id:string;source:[number,number];scale:number}[] = [
  {slot:'bridge',id:'yorkshire-railway-viaduct',source:[-5.55,327],scale:.72},
  {slot:'tractor',id:'tractor-in-field',source:[283,379],scale:.90},
  {slot:'observatory',id:'hilltop-observatory-haven',source:[929,450],scale:1},
  {slot:'grounds',id:'west-cottage-grounds',source:[130,500],scale:1},
  {slot:'pumpkins',id:'cottage-pumpkin-patch',source:[167,558],scale:1},
  {slot:'cabin',id:'wooden-cabin-cluster',source:[289,548],scale:1},
  {slot:'home',id:'living-cottage-haven',source:[560.4,518],scale:1},
  {slot:'pod',id:'capsule-pod-cluster',source:[864,543],scale:1},
  {slot:'pen',id:'yorkshire-sheep-pen-cluster',source:[929,659],scale:.92},
  {slot:'flock',id:'yorkshire-sheep-flock-and-dressing',source:[672,649],scale:.94},
];
export const ASSET_PLACEMENTS:AssetPlacement[]=SOURCE_ASSETS.map(source=>{
  const placement=SCENE_PLACEMENTS.find(p=>p.slot===source.slot)!;
  return {...source,name:placement.name,u:placement.u,d:placement.d};
});

export function assetLayout() {
  return ASSET_PLACEMENTS.map(asset=>{
    const {h,target}=sceneLayout().find(p=>p.slot===asset.slot)!;
    return {...asset,h,target,dx:target.x-asset.source[0]*asset.scale,dy:target.y-asset.source[1]*asset.scale};
  });
}

let composition: Promise<{url:string;svg:string}> | undefined;
export function loadAssetComposition() {
  return composition??=(async()=>{
    const response=await fetch('/reference/live-assets.svg');
    if(!response.ok)throw new Error('无法载入 Live With Me 原始资产');
    const doc=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
    if(doc.querySelector('parsererror'))throw new Error('原始 SVG 无法解析');
    const root=doc.documentElement;
    for(const asset of assetLayout()){
      const original=root.querySelector(`[data-source-id="${asset.id}"]`);
      if(!original)throw new Error(`缺少核心资产：${asset.name}`);
      const wrapper=doc.createElementNS(root.namespaceURI,'g');
      wrapper.setAttribute('data-placement-id',asset.id);
      wrapper.setAttribute('transform',`translate(${asset.dx} ${asset.dy}) scale(${asset.scale})`);
      // Reappend in the explicit back-to-front composition order, preserving the original wrapper.
      wrapper.append(original);root.append(wrapper);
    }
    const svg=new XMLSerializer().serializeToString(root);
    return {svg,url:URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}))};
  })().catch(error=>{composition=undefined;throw error;});
}

if(import.meta.hot)import.meta.hot.dispose(()=>{composition?.then(({url})=>URL.revokeObjectURL(url)).catch(()=>{});});
