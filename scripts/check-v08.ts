import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Vector3} from 'three';
import {terrainGeometry} from '../src/terrain/ridgeSurface';
import {GROUND_GRID,groundHeight,renderedGroundHeight,HOME_HEIGHT,LIVING_AREA,FIELDS,fieldPoint,riverCenter,riverWidth,riverHeight,terrainSample} from '../src/terrain/layout';
import {SCENE_PLACEMENTS} from '../src/composition/placements';
import {FRAME,INTEGRATION_FRAME,createOverviewCamera,projectPoint,worldPoint,measureProjection} from '../src/world/projection';
const g=terrainGeometry(),p=g.getAttribute('position'),n=g.getAttribute('normal'),idx=g.getIndex()!,edges=new Map<string,number>();
const parent=Array.from({length:p.count},(_,i)=>i);
function root(i:number):number {while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
let invalid=0,downward=0,degenerate=0,maxNormalError=0;
for(let i=0;i<p.count;i++){
 if(![p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite))invalid++;
 if(n.getY(i)<=0)downward++;
 maxNormalError=Math.max(maxNormalError,Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1));
}
for(let i=0;i<idx.count;i+=3){
 const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)],[a,b,c]=ids.map(k=>new Vector3().fromBufferAttribute(p,k));
 if(b.sub(a).cross(c.sub(a)).length()<1e-6)degenerate++;
 for(let k=0;k<3;k++){const x=ids[k],y=ids[(k+1)%3],key=x<y?`${x},${y}`:`${y},${x}`;edges.set(key,(edges.get(key)??0)+1);parent[root(x)]=root(y);}
}
assert.equal(invalid,0);assert.equal(degenerate,0);assert.equal(downward,0);assert.ok(maxNormalError<.001);
const components=new Set(parent.map((_,i)=>root(i))).size;assert.equal(components,1);
let internalHoles=0,boundaryEdges=0;
const {minU,width,minD,depth}=GROUND_GRID;
for(const [key,count] of edges){
 assert.ok(count<=2);if(count!==1)continue;boundaryEdges++;
 const points=key.split(',').map(Number).map(i=>({u:(p.getX(i)-p.getZ(i))*Math.SQRT1_2,d:-(p.getX(i)+p.getZ(i))*Math.SQRT1_2}));
 if(!([['u',minU],['u',minU+width],['d',minD],['d',minD+depth]] as const).some(([axis,v])=>points.every(q=>Math.abs(q[axis]-v)<.02)))internalHoles++;
}
assert.equal(internalHoles,0);assert.equal(p.count-edges.size+idx.count/3,1,'Terrain must be a single open disk');
assert.ok(Math.abs(groundHeight(LIVING_AREA.u,LIVING_AREA.d)-HOME_HEIGHT)<.05);
const support=SCENE_PLACEMENTS.filter(p=>p.slot!=='bridge').map(p=>{
 const heights:number[]=[];
 for(const x of [-.5,0,.5])for(const z of [-.5,0,.5])heights.push(groundHeight(p.u+(x*p.footprint.width-z*p.footprint.depth)*Math.SQRT1_2,p.d-(x*p.footprint.width+z*p.footprint.depth)*Math.SQRT1_2));
 const variation=Math.max(...heights)-Math.min(...heights);return {slot:p.slot,variation,center:groundHeight(p.u,p.d)};
});
for(const s of support.filter(s=>s.slot!=='tractor'))assert.ok(s.variation<7,`${s.slot} needs flatter support: ${s.variation}`);
const fields=FIELDS.map(f=>{
 let near=Infinity,far=-Infinity,maxHeight=-Infinity,minHeight=Infinity,area=0,maxProjectionBacktrack=0;
 for(let j=0;j<=80;j++)for(let i=0;i<=80;i++){
  const q=fieldPoint(f,i/80,j/80);near=Math.min(near,q.d);far=Math.max(far,q.d);maxHeight=Math.max(maxHeight,q.h);minHeight=Math.min(minHeight,q.h);
  if(j<80){const next=fieldPoint(f,i/80,(j+1)/80);maxProjectionBacktrack=Math.max(maxProjectionBacktrack,projectPoint(next.u,next.d,next.h).y-projectPoint(q.u,q.d,q.h).y);}
  if(i<80&&j<80){const b=fieldPoint(f,(i+1)/80,j/80),c=fieldPoint(f,i/80,(j+1)/80);area+=Math.abs((b.u-q.u)*(c.d-q.d)-(c.u-q.u)*(b.d-q.d));}
 }
 assert.ok(maxHeight<=HOME_HEIGHT+2);assert.ok(maxProjectionBacktrack<.15,`${f.id} folds behind itself in target projection`);
 return {id:f.id,near,far,area,minHeight,maxHeight,maxProjectionBacktrack};
});
const extension=(Math.max(...fields.map(f=>f.far))-fields[0].far)/(fields[0].far-fields[0].near);
assert.ok(extension>=.15&&extension<=.25,`Field extension ${extension}`);
assert.ok(fields[1].area<fields[0].area*.3&&fields[2].area<fields[1].area);
let riverCenterOcclusions=0,maxBankSlope=0,maxSlopeJump=0,maxCrestHeight=-Infinity;
for(let d=300;d<=1740;d+=4){
 const u=riverCenter(d);if(renderedGroundHeight(u,d)>riverHeight(d)-.2)riverCenterOcclusions++;
 const w=riverWidth(d),tangent=(riverCenter(d+1)-riverCenter(d-1))/2;
 for(let offset=-360;offset<=360;offset+=8){const x=u+offset*Math.hypot(1,tangent),dx=(groundHeight(x+1,d)-groundHeight(x-1,d))/2,dz=(groundHeight(x,d+1)-groundHeight(x,d-1))/2;maxBankSlope=Math.max(maxBankSlope,Math.hypot(dx,dz));}
 for(const x of [-700,-400,0,400,700]){
  const left=(groundHeight(x,d)-groundHeight(x,d-.1))/.1,right=(groundHeight(x,d+.1)-groundHeight(x,d))/.1;maxSlopeJump=Math.max(maxSlopeJump,Math.abs(left-right));
  if(d>=1200)maxCrestHeight=Math.max(maxCrestHeight,terrainSample(x,d).h);
 }
}
assert.equal(riverCenterOcclusions,0);assert.ok(maxSlopeJump<.05);assert.ok(maxBankSlope<1);assert.ok(maxCrestHeight<HOME_HEIGHT);
let maxProjectionError=0;
for(const frame of [FRAME,INTEGRATION_FRAME])for(const u of [-700,0,700])for(const d of [-600,0,900,1700]){
 const h=groundHeight(u,d),projected=worldPoint(u,d,h).project(createOverviewCamera(frame)),expected=projectPoint(u,d,h,frame);
 maxProjectionError=Math.max(maxProjectionError,Math.abs(expected.x-(projected.x+1)*frame.width/2),Math.abs(expected.y-(1-projected.y)*frame.height/2));
}
assert.ok(maxProjectionError<1e-7);
const hashes:Record<string,string>={};for(const file of ['src/world/projection.ts','public/reference/live-assets.svg'])hashes[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
const report={version:'0.8',passed:true,artApproval:'PENDING_AUTHOR_REVIEW',mesh:{vertices:p.count,triangles:idx.count/3,components,internalHoles,boundaryEdges,invalid,downward,degenerate,maxNormalError},support,fields,extension,river:{riverCenterOcclusions,maxBankSlope,maxSlopeJump},maxCrestHeight,maxProjectionError,projection:[measureProjection(FRAME),measureProjection(INTEGRATION_FRAME)],hashes,limitations:['Finite terrain heightfield has an open outer boundary.','Formal SVG is a target-camera composition check, not orbitable 3D architecture.','Static local haze is a vertex-colour aerial wash, not volumetric fog.']};
await fs.mkdir('evidence/v08',{recursive:true});await fs.writeFile('evidence/v08/geometry-report.json',JSON.stringify(report,null,2));await fs.writeFile('public/benchmark-geometry-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));g.dispose();
