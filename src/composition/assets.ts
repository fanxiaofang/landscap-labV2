import { groundHeight } from '../terrain/layout';
import { projectPoint } from '../world/projection';

export interface AssetPlacement {
  id: string;
  name: string;
  /** Ground contact in the original, already projected SVG snapshot. */
  source: [number, number];
  u: number;
  d: number;
  scale: number;
}

// Only placement changes here. The source SVG, projection axes and asset drawings stay intact.
// Positions are terrain coordinates; editing the terrain moves their contact points with it.
export const ASSET_PLACEMENTS: AssetPlacement[] = [
  {id:'yorkshire-railway-viaduct',name:'高架桥与小火车',source:[-5.55,327],u:-465,d:880,scale:.72},
  {id:'tractor-in-field',name:'拖拉机',source:[283,379],u:-405,d:365,scale:.90},
  {id:'hilltop-observatory-haven',name:'通讯观测台',source:[929,450],u:340,d:-18,scale:1},
  {id:'west-cottage-grounds',name:'蜂箱与生活小设施',source:[130,500],u:-390,d:-180,scale:1},
  {id:'cottage-pumpkin-patch',name:'南瓜地',source:[167,558],u:-365,d:-430,scale:1},
  {id:'wooden-cabin-cluster',name:'小木屋',source:[289,548],u:-245,d:-290,scale:1},
  {id:'living-cottage-haven',name:'主屋生活区',source:[560.4,518],u:35,d:-280,scale:1},
  {id:'capsule-pod-cluster',name:'胶囊生活舱',source:[864,543],u:313,d:-330,scale:1},
  {id:'yorkshire-sheep-pen-cluster',name:'羊圈',source:[929,659],u:348,d:-620,scale:.92},
  {id:'yorkshire-sheep-flock-and-dressing',name:'生活树与散养羊群',source:[672,649],u:125,d:-690,scale:.94},
];

export function assetLayout() {
  return ASSET_PLACEMENTS.map(asset=>{
    const h=groundHeight(asset.u,asset.d);
    const target=projectPoint(asset.u,asset.d,h);
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
