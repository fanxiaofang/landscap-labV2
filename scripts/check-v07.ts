import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Vector3} from 'three';
import {terrainGeometry,createTerrainSampler} from '../src/terrain/ridgeSurface';
import {GROUND_GRID,groundHeight,HOME_HEIGHT,LIVING_AREA,RIDGES} from '../src/terrain/layout';
import {FRAME,INTEGRATION_FRAME,createOverviewCamera,projectPoint,worldPoint,measureProjection} from '../src/world/projection';

const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const baseline=JSON.parse(await fs.readFile('evidence/v07/baseline/manifest.json','utf8'));
const frozen=['src/world/projection.ts','src/world/environment.ts','src/world/cloudField.ts','src/world/cloudSea.ts'];
for(const f of frozen)assert.equal(hash(await fs.readFile(f)),baseline.hashes[f],`${f} must remain frozen`);
const original=(file:string)=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n');
const current=async(file:string)=>(await fs.readFile(file,'utf8')).replaceAll('\r\n','\n');
const between=(s:string,a:string,b:string)=>s.slice(s.indexOf(a),s.indexOf(b));
assert.equal(between(await current('src/terrain/layout.ts'),'export function valleyHeight','export function shoulderDepth'),between(original('src/terrain/layout.ts'),'export function valleyHeight','export function shoulderDepth'),'Frozen cloud far sink must retain the same valley function');
assert.equal(between(await current('src/world/renderer.ts'),'export function drawSky','export class LandscapeRenderer'),between(original('src/world/renderer.ts'),'export function drawSky','export class LandscapeRenderer'),'Preserve the actual sky renderer');

const g=terrainGeometry(),p=g.getAttribute('position'),n=g.getAttribute('normal'),idx=g.getIndex()!;
const parent=Array.from({length:p.count},(_,i)=>i);
function root(i:number):number {while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
const edges=new Map<string,number>();
let invalid=0,downward=0,degenerate=0,maxNormalError=0;
for(let i=0;i<p.count;i++){
  if(![p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite))invalid++;
  if(n.getY(i)<-1e-5)downward++;
  maxNormalError=Math.max(maxNormalError,Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1));
}
for(let i=0;i<idx.count;i+=3){
  const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
  const [a,b,c]=ids.map(k=>new Vector3().fromBufferAttribute(p,k));
  if(b.sub(a).cross(c.sub(a)).length()<1e-6)degenerate++;
  for(let k=0;k<3;k++){
    const x=ids[k],y=ids[(k+1)%3],key=x<y?`${x},${y}`:`${y},${x}`;
    edges.set(key,(edges.get(key)??0)+1);parent[root(x)]=root(y);
  }
}
assert.equal(invalid,0);assert.equal(degenerate,0);assert.equal(downward,0);assert.ok(maxNormalError<.001);
const components=new Set(parent.map((_,i)=>root(i))).size;assert.equal(components,1,'Terrain must be one connected mesh');
let boundaryEdges=0,internalHoles=0;
const {minU,width,minD,depth}=GROUND_GRID;
for(const [key,count] of edges){
  assert.ok(count<=2,'Non-manifold terrain edge');
  if(count!==1)continue;
  boundaryEdges++;
  const points=key.split(',').map(Number).map(i=>({u:(p.getX(i)-p.getZ(i))*Math.SQRT1_2,d:-(p.getX(i)+p.getZ(i))*Math.SQRT1_2}));
  const outer=[['u',minU],['u',minU+width],['d',minD],['d',minD+depth]] as const;
  if(!outer.some(([axis,value])=>points.every(q=>Math.abs(q[axis]-value)<.02)))internalHoles++;
}
assert.equal(internalHoles,0,'No internal cracks or disconnected mountain feet');

const {sample}=createTerrainSampler();
const home=sample(LIVING_AREA.u,LIVING_AREA.d);assert.ok(Math.abs(home.h-HOME_HEIGHT)<.05,'Local living pad changed elevation');
const ridges=RIDGES.map(def=>{
  const controls=def.points.map(q=>({...q,actual:sample(q.u,q.d).h,screen:projectPoint(q.u,q.d,sample(q.u,q.d).h)}));
  assert.ok(controls.every(q=>q.actual<HOME_HEIGHT),'Mountain crest above high meadow');
  return {id:def.id,name:def.name,controls};
});
const sections=[-650,-360,70,650].map(u=>({u,samples:Array.from({length:71},(_,i)=>{const d=-500+i*50;return {d,ground:groundHeight(u,d),surface:sample(u,d).h};})}));
let maxProjectionError=0;
for(const frame of [FRAME,INTEGRATION_FRAME]){
  const camera=createOverviewCamera(frame);
  for(const ridge of ridges)for(const q of ridge.controls){
    const projected=worldPoint(q.u,q.d,q.actual).project(camera),expected=projectPoint(q.u,q.d,q.actual,frame);
    maxProjectionError=Math.max(maxProjectionError,Math.abs(expected.x-(projected.x+1)*frame.width/2),Math.abs(expected.y-(1-projected.y)*frame.height/2));
  }
}
assert.ok(maxProjectionError<1e-7);
const report={version:'0.7',passed:true,artApproval:'PENDING_AUTHOR_REVIEW',integrationEnabled:false,frozen,
  mesh:{vertices:p.count,triangles:idx.count/3,invalid,degenerate,downward,maxNormalError,components,boundaryEdges,internalHoles},
  home,ridges,sections,maxProjectionError,projection:[measureProjection(FRAME),measureProjection(INTEGRATION_FRAME)],
  limitations:['Connectivity, winding and camera compatibility are engineering checks, not art acceptance.','Proxy/formal asset placement is unapproved. The finite terrain patch has an open outer boundary, visible if orbiting beyond the study area.']};
await fs.mkdir('evidence/v07',{recursive:true});
await fs.writeFile('evidence/v07/geometry-report.json',JSON.stringify(report,null,2));
await fs.writeFile('public/benchmark-geometry-report.json',JSON.stringify(report,null,2));
g.dispose();console.log(JSON.stringify({passed:true,...report.mesh,maxProjectionError,frozen},null,2));
