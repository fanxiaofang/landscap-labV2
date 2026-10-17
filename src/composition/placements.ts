import { groundHeight, LIVING_AREA } from '../terrain/layout';
import { projectPoint } from '../world/projection';

export type SceneSlot = 'home' | 'tractor' | 'bridge' | 'cabin' | 'observatory' | 'pod' | 'pen' | 'flock' | 'pumpkins' | 'grounds';
export type CompositionView = 'terrain' | 'proxy';
export interface ScenePlacement {
  slot: SceneSlot;
  name: string;
  u: number;
  d: number;
  /** Dimensions along the project's two world-ground axes, independent of any source drawing. */
  footprint: { width: number; depth: number };
  height: number;
  kind: 'volume' | 'footprint' | 'bridge';
}

// Narrative zones follow the land. SVG source IDs, source feet and scales belong to assets.ts.
export const SCENE_PLACEMENTS: ScenePlacement[] = [
  {slot:'bridge',name:'桥 / 火车',u:-645,d:810,footprint:{width:480,depth:40},height:48,kind:'bridge'},
  {slot:'observatory',name:'通讯设施',u:460,d:-120,footprint:{width:76,depth:62},height:48,kind:'volume'},
  {slot:'home',name:'主屋生活区',u:LIVING_AREA.u,d:LIVING_AREA.d,footprint:{width:350,depth:205},height:82,kind:'volume'},
  {slot:'tractor',name:'拖拉机',u:-500,d:170,footprint:{width:48,depth:30},height:20,kind:'volume'},
  {slot:'cabin',name:'小木屋',u:-240,d:-290,footprint:{width:90,depth:70},height:38,kind:'volume'},
  {slot:'pod',name:'生活舱',u:405,d:-390,footprint:{width:80,depth:56},height:34,kind:'volume'},
  {slot:'grounds',name:'辅助设施',u:-390,d:-425,footprint:{width:68,depth:48},height:14,kind:'volume'},
  {slot:'pumpkins',name:'南瓜地',u:-555,d:-560,footprint:{width:100,depth:78},height:0,kind:'footprint'},
  {slot:'flock',name:'羊群 / 生活树',u:30,d:-660,footprint:{width:145,depth:105},height:0,kind:'footprint'},
  {slot:'pen',name:'羊圈',u:500,d:-680,footprint:{width:120,depth:105},height:0,kind:'footprint'},
];

export function sceneLayout() {
  return SCENE_PLACEMENTS.map(placement=>{
    const h=groundHeight(placement.u,placement.d);
    return {...placement,h,target:projectPoint(placement.u,placement.d,h)};
  });
}
