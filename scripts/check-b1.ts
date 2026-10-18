import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Mesh,Raycaster,Vector3} from 'three';
import {buildMidFar,LANDFORMS,ridgePoint,riverPoint,floorHeight} from '../src/b1/model';
import {createOverviewCamera,FRAME,INTEGRATION_FRAME,frameMapping,measureProjection,projectPoint,worldPoint} from '../src/world/projection';
import {navigate,clampNavigation,LIMITS} from '../src/b1/camera';

const {group}=buildMidFar();group.updateMatrixWorld(true);
const meshes=group.children.filter((m):m is Mesh=>m instanceof Mesh);
const forms=LANDFORMS.map(def=>{
 const m=meshes.find(m=>m.name===def.id)!,g=m.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),idx=g.index!;
 assert.ok(Array.from(p.array).every(Number.isFinite));assert.ok(Array.from(n.array).every(Number.isFinite));
 // Weld only for topology measurement: split shading normals are intentional.
 const vertices=new Map<string,number>(),weld:number[]=[];
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(3)).join(',');if(!vertices.has(key))vertices.set(key,vertices.size);weld.push(vertices.get(key)!);}
 const edges=new Map<string,number>();let degenerate=0,volume=0;
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),cross=new Vector3();
 for(let i=0;i<idx.count;i+=3){const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);cross.crossVectors(b.clone().sub(a),c.clone().sub(a));if(cross.length()<1e-7)degenerate++;volume+=a.dot(b.clone().cross(c))/6;for(let k=0;k<3;k++){const v=[weld[ids[k]],weld[ids[(k+1)%3]]].sort((x,y)=>x-y).join('-');edges.set(v,(edges.get(v)??0)+1);}}
 const openEdges=[...edges.values()].filter(n=>n!==2).length;
 assert.equal(openEdges,0,`${def.id}: closed shell`);assert.equal(degenerate,0);assert.ok(Math.abs(volume)>100000);
 const toeErrors:number[]=[];for(let i=0;i<=30;i++)for(const r of [-1,1]){const q=ridgePoint(def,i/30,r);toeErrors.push(Math.abs(q.h-floorHeight(q.u,q.d)));}
 assert.ok(Math.max(...toeErrors)<1e-8);
 const front=ridgePoint(def,.5,-.5),crest=ridgePoint(def,.5,0),back=ridgePoint(def,.5,.5);
 assert.ok(crest.h>front.h+10&&crest.h>back.h+10,`${def.id}: real front and rear slopes`);
 return {id:def.id,layer:def.layer,vertices:p.count,triangles:idx.count/3,openEdges,degenerate,signedVolume:volume,crest,front,back,maxToeError:Math.max(...toeErrors)};
});
const land=meshes.filter(m=>m.userData.layer!=='water'),ray=new Raycaster(),river=[];
for(let i=0;i<=90;i++){
 const p=riverPoint(i/100),v=worldPoint(p.u,p.d,10000);ray.set(v,new Vector3(0,-1,0));const hit=ray.intersectObjects(land)[0];
 const water=floorHeight(p.u,p.d)+2.7,clearance=water-(hit?.point.y??-10000);
 if(p.d<1100)assert.ok(clearance>.35,`River blocked at d=${p.d.toFixed(1)} by ${hit?.object.name}`);
 river.push({d:p.d,clearance,occluder:hit?.object.name});
}
const navigation=[];
for(const frame of [FRAME,INTEGRATION_FRAME]){
 const projection=measureProjection(frame);assert.ok(projection.maxSlopeError<1e-12);
 for(const x of [-LIMITS.x,0,LIMITS.x])for(const y of [-LIMITS.y,0,LIMITS.y])for(const zoom of [LIMITS.minZoom,1,LIMITS.maxZoom]){
  const camera=createOverviewCamera(frame),nav={x,y,zoom};navigate(camera,frame,nav);let maxError=0;
  for(const [u,d,h] of [[0,0,200],[-500,700,220],[500,1400,120]]){
   const base=projectPoint(u,d,h,frame),p=worldPoint(u,d,h).project(camera),scale=frameMapping(frame).scale;
   const expected={x:frame.width/2+(base.x-frame.width/2)*zoom+x*scale,y:frame.height/2+(base.y-frame.height/2)*zoom+y*scale};
   maxError=Math.max(maxError,Math.hypot((p.x+1)*frame.width/2-expected.x,(1-p.y)*frame.height/2-expected.y));
  }
  assert.ok(maxError<1e-8);navigation.push({frame,nav,maxRegistrationErrorPx:maxError});
 }
}
assert.deepEqual(clampNavigation({x:900,y:-900,zoom:5}),{x:100,y:-45,zoom:1.18});
const report={phase:'B1',passed:true,artApproval:'PENDING_AUTHOR_REVIEW',projection:measureProjection(),forms,river,navigation,scope:'Closed curve lofts, local floodplain. No V0.8 foreground heightfield or building proxies.'};
await fs.mkdir('evidence/b1',{recursive:true});await fs.writeFile('evidence/b1/geometry-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:true,forms:forms.length,navigationStates:navigation.length,maxRegistrationErrorPx:Math.max(...navigation.map(n=>n.maxRegistrationErrorPx)),riverMinClearance:Math.min(...river.filter(p=>p.d<1100).map(p=>p.clearance))},null,2));
