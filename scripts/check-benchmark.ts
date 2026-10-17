import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Mesh, Vector3, type BufferGeometry } from 'three';
import { buildGround, ridgeGeometry } from '../src/terrain/geometry';
import { ridgeSampler } from '../src/terrain/ridgeSurface';
import { groundHeight, valleyHeight, shoulderDepth, HOME_HEIGHT, RIDGES } from '../src/terrain/layout';
import { buildCloudSea } from '../src/world/cloudSea';
import { cloudHeight } from '../src/world/cloudField';
import { projectPoint, worldPoint, createOverviewCamera } from '../src/world/projection';

function inspect(g:BufferGeometry){
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),index=g.getIndex()!;
  let invalid=0,degenerate=0,downward=0,maxNormalError=0;
  for(let i=0;i<p.count;i++){
    if(![p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite))invalid++;
    if(n.getY(i)<-1e-5)downward++;
    maxNormalError=Math.max(maxNormalError,Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1));
  }
  for(let i=0;i<index.count;i+=3){
    const [a,b,c]=[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,index.getX(i+k)));
    if(b.sub(a).cross(c.sub(a)).length()<1e-6)degenerate++;
  }
  assert.equal(invalid,0);assert.equal(downward,0);assert.equal(degenerate,0);assert.ok(maxNormalError<.001);
  return {vertices:p.count,triangles:index.count/3,invalid,degenerate,downward,maxNormalError};
}
const meshes:Record<string,ReturnType<typeof inspect>>={};
const ground=buildGround();meshes.ground=inspect(ground.geometry);ground.geometry.dispose();(ground.material as any).dispose();
const ridges=RIDGES.map(def=>{
  const g=ridgeGeometry(def);meshes[def.id]=inspect(g);const p=g.getAttribute('position');
  let maxHeight=-Infinity;for(let i=0;i<p.count;i++)maxHeight=Math.max(maxHeight,p.getY(i));
  assert.ok(maxHeight<HOME_HEIGHT,`${def.id} must remain below the high meadow`);
  const {heightAt}=ridgeSampler(def);
  const controls=def.points.map(c=>({u:c.u,d:c.d,terrain:heightAt(c.u,c.d),cloud:cloudHeight(c.u,c.d),screen:projectPoint(c.u,c.d,heightAt(c.u,c.d))}));
  g.dispose();return {id:def.id,maxHeight,clearanceBelowMeadow:HOME_HEIGHT-maxHeight,controls};
});
const clouds=buildCloudSea();clouds.traverse(o=>{if(o instanceof Mesh){meshes[o.name]=inspect(o.geometry);o.geometry.dispose();(o.material as any).dispose();}});
const sections=[-560,0,560].map(u=>{
  const shoulder=shoulderDepth(u),samples=Array.from({length:61},(_,i)=>{
    const d=shoulder+i*25;return {d,h:groundHeight(u,d),screen:projectPoint(u,d,groundHeight(u,d))};
  });
  const drop=samples[0].h-samples.at(-1)!.h;
  assert.ok(drop>500,'Meadow must actually descend into the basin');
  return {u,drop,samples};
});
let maxProjectionError=0;
const camera=createOverviewCamera();
for(const ridge of ridges)for(const p of ridge.controls){
  const v=worldPoint(p.u,p.d,p.terrain).project(camera);
  maxProjectionError=Math.max(maxProjectionError,Math.abs(p.screen.x-(v.x+1)*800),Math.abs(p.screen.y-(1-v.y)*450));
}
assert.ok(maxProjectionError<1e-7);
const cloudSections=[1600,2200,2800,3400].map(d=>{
  const heights=Array.from({length:81},(_,i)=>cloudHeight(-800+i*20,d));
  const relief=Math.max(...heights)-Math.min(...heights);assert.ok(relief>25,'Cloud surface lost its billows');
  return {d,relief};
});
// Sample the open channel, away from mountains, to catch exposed holes in basin fill.
const channel=[{u:-350,d:2100},{u:25,d:3000},{u:380,d:3500}].map(p=>({...p,clearance:cloudHeight(p.u,p.d)-valleyHeight(p.u,p.d)}));
assert.ok(channel.every(p=>p.clearance>0),'Clouds must fill the open valley');
const report={version:'0.5',scope:'midground mountain benchmark only',passed:true,artApproval:'PENDING_AUTHOR_REVIEW',integrationEnabled:false,meshes,ridges,sections,cloudSections,channel,maxProjectionError,limitations:['Numerical checks do not validate the artistic silhouette or cloud appearance.','No formal assets, farm layout, Proxy placement or full-scene integration were tested.','Some near mountain aprons still overlap in the clear view; see REVIEW.md.']};
await fs.mkdir('evidence/v05',{recursive:true});
await fs.writeFile('evidence/v05/geometry-report.json',JSON.stringify(report,null,2));
await fs.writeFile('public/benchmark-geometry-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:true,meshCount:Object.keys(meshes).length,maxProjectionError,sections:sections.map(({u,drop})=>({u,drop})),cloudSections,channel},null,2));
