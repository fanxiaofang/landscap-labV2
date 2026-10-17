import { OrthographicCamera, Vector3 } from 'three';

export const FRAME = { width: 1200, height: 800 } as const;
export const PROJECTION = {
  groundSlope: 77 / 272,
  azimuthDegrees: 45,
  elevation: Math.asin(77 / 272),
  centerY: 530,
  homeElevation: 200,
  overview: { x: 0, y: 135, zoom: 0.66 },
} as const;
const q = Math.SQRT1_2;
// u = camera-right; d = away from viewer; h = elevation. All are study units, not metres.
export function worldPoint(u: number, d: number, h: number) {
  return new Vector3((u - d) * q, h, (-u - d) * q);
}
export function createOverviewCamera() {
  const camera = new OrthographicCamera(-600, 600, 530, -270, 1, 30000);
  const target = worldPoint(0, 0, PROJECTION.homeElevation);
  const e = PROJECTION.elevation;
  camera.position.copy(target).add(new Vector3(q * Math.cos(e), Math.sin(e), q * Math.cos(e)).multiplyScalar(12000));
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}
export function projectPoint(u: number, d: number, h: number) {
  return { x: 600 + u, y: PROJECTION.centerY - Math.sin(PROJECTION.elevation) * d - Math.cos(PROJECTION.elevation) * (h - PROJECTION.homeElevation) };
}
export function projectScenePoint(x: number, y: number) {
  const c=PROJECTION.overview;
  return { x:600+(x-600)*c.zoom+c.x, y:400+(y-400)*c.zoom+c.y };
}
export function measureProjection() {
  const camera=createOverviewCamera();
  const toScreen=(v:Vector3)=>{const p=v.project(camera);return {x:(p.x+1)*600,y:(1-p.y)*400};};
  const o=toScreen(new Vector3(0,200,0));
  const a=toScreen(new Vector3(100,200,0));
  const b=toScreen(new Vector3(0,200,-100));
  const slopes=[(a.y-o.y)/(a.x-o.x),(b.y-o.y)/(b.x-o.x)];
  return {azimuthDegrees:45,elevationDegrees:PROJECTION.elevation*180/Math.PI,slopes,anglesDegrees:slopes.map(s=>Math.atan(s)*180/Math.PI),maxSlopeError:Math.max(...slopes.map(s=>Math.abs(Math.abs(s)-77/272)))};
}
