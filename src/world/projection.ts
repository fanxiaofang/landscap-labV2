import { OrthographicCamera, Vector3 } from 'three';

export const FRAME = { width:1600, height:900 } as const;
export const INTEGRATION_FRAME = { width:1200, height:800 } as const;
export type Frame = {width:number;height:number};
export const PROJECTION = {
  groundSlope:77/272, azimuthDegrees:45, elevation:Math.asin(77/272),
  centerY:600, homeElevation:200, overview:{x:0,y:135,zoom:.66},
} as const;
const q=Math.SQRT1_2;
export function worldPoint(u:number,d:number,h:number) {return new Vector3((u-d)*q,h,(-u-d)*q);}
// 3:2 compatibility expands vertical coverage, preserving the exact ground-axis slopes.
export function frameMapping(frame:Frame=FRAME) {
  const scale=frame.width/FRAME.width;
  return {scale,offsetY:(frame.height-FRAME.height*scale)/2};
}
export function createOverviewCamera(frame:Frame=FRAME) {
  const {scale,offsetY}=frameMapping(frame),top=PROJECTION.centerY+offsetY/scale;
  const camera=new OrthographicCamera(-800,800,top,top-frame.height/scale,1,30000);
  const target=worldPoint(0,0,PROJECTION.homeElevation),e=PROJECTION.elevation;
  camera.position.copy(target).add(new Vector3(q*Math.cos(e),Math.sin(e),q*Math.cos(e)).multiplyScalar(12000));
  camera.up.set(0,1,0);camera.lookAt(target);camera.updateMatrixWorld();return camera;
}
export function projectPoint(u:number,d:number,h:number,frame:Frame=FRAME) {
  const {scale,offsetY}=frameMapping(frame);
  return {x:(800+u)*scale,y:(PROJECTION.centerY-Math.sin(PROJECTION.elevation)*d-Math.cos(PROJECTION.elevation)*(h-200))*scale+offsetY};
}
export function projectScenePoint(x:number,y:number) {
  const c=PROJECTION.overview;return {x:600+(x-600)*c.zoom+c.x,y:400+(y-400)*c.zoom+c.y};
}
export function measureProjection(frame:Frame=FRAME) {
  const camera=createOverviewCamera(frame);
  const screen=(v:Vector3)=>{const p=v.project(camera);return {x:(p.x+1)*frame.width/2,y:(1-p.y)*frame.height/2};};
  const o=screen(new Vector3(0,200,0)),a=screen(new Vector3(100,200,0)),b=screen(new Vector3(0,200,-100));
  const slopes=[(a.y-o.y)/(a.x-o.x),(b.y-o.y)/(b.x-o.x)];
  return {azimuthDegrees:45,elevationDegrees:PROJECTION.elevation*180/Math.PI,slopes,anglesDegrees:slopes.map(s=>Math.atan(s)*180/Math.PI),maxSlopeError:Math.max(...slopes.map(s=>Math.abs(Math.abs(s)-77/272)))};
}
