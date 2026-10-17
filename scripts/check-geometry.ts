import fs from 'node:fs/promises';
import { CatmullRomCurve3, Vector3, type BufferGeometry, Mesh } from 'three';
import { groundHeight, shoulderDepth, shoulderWidth, HOME_HEIGHT, RIDGES, WALK_ROUTE, FIELDS, fieldPoint, renderedGroundHeight } from '../src/terrain/layout';
import { buildGround, buildFields, buildMeadowZones, ridgeGeometry } from '../src/terrain/geometry';
import { measureProjection, projectPoint } from '../src/world/projection';
import { sceneLayout } from '../src/composition/placements';

const round=(n:number)=>Number(n.toFixed(6));
function auditMesh(g:BufferGeometry) {
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),idx=g.getIndex()!;
  let nonFinite=0,degenerate=0,downwardNormals=0,maxNormalError=0,minArea=Infinity,maxEdge=0;
  for(let i=0;i<p.count;i++){
    if(![p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite))nonFinite++;
    if(n.getY(i)<-1e-5)downwardNormals++;
    maxNormalError=Math.max(maxNormalError,Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1));
  }
  const edges=new Map<string,number>();
  for(let i=0;i<idx.count;i+=3){
    const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
    const [a,b,c]=ids.map(id=>new Vector3().fromBufferAttribute(p,id));
    const area=b.clone().sub(a).cross(c.clone().sub(a)).length()/2;
    minArea=Math.min(minArea,area);if(area<1e-6)degenerate++;
    for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)||0)+1);maxEdge=Math.max(maxEdge,new Vector3().fromBufferAttribute(p,a).distanceTo(new Vector3().fromBufferAttribute(p,b)));}
  }
  const counts=[...edges.values()];
  return {vertices:p.count,triangles:idx.count/3,nonFinite,degenerate,downwardNormals,maxNormalError:round(maxNormalError),minTriangleArea:round(minArea),maxEdge:round(maxEdge),boundaryEdges:counts.filter(c=>c===1).length,nonManifoldEdges:counts.filter(c=>c>2).length};
}
const samples=[
  ...sceneLayout().map(({name,u,d})=>({name,u,d})),
  {name:'西侧农田路径末端',u:WALK_ROUTE.at(-1)!.u,d:WALK_ROUTE.at(-1)!.d},
  {name:'中央谷底',u:100,d:2500},
  {name:'东侧谷底',u:650,d:2620},
].map(p=>({...p,elevation:round(groundHeight(p.u,p.d)),screen:projectPoint(p.u,p.d,groundHeight(p.u,p.d))}));
const meshReports:Record<string,ReturnType<typeof auditMesh>>={};
const ground=buildGround();meshReports.ground=auditMesh(ground.geometry);ground.geometry.dispose();(ground.material as any).dispose();
const ridgeReports=RIDGES.map(def=>{
  const g=ridgeGeometry(def);meshReports[def.id]=auditMesh(g);
  const pos=g.getAttribute('position');let peak=-Infinity,peakIndex=0;
  for(let i=0;i<pos.count;i++)if(pos.getY(i)>peak){peak=pos.getY(i);peakIndex=i;}
  const u=(pos.getX(peakIndex)-pos.getZ(peakIndex))*Math.SQRT1_2,d=-(pos.getX(peakIndex)+pos.getZ(peakIndex))*Math.SQRT1_2;
  g.dispose();return {id:def.id,name:def.name,maxElevation:round(peak),belowMeadow:peak<HOME_HEIGHT,clearance:round(HOME_HEIGHT-peak),u:round(u),d:round(d),screen:projectPoint(u,d,peak)};
});
const routeCurve=new CatmullRomCurve3(WALK_ROUTE.map(p=>new Vector3(p.u,0,p.d)),false,'catmullrom',.3);
let distance=0,lastHeight:number|undefined,lastPoint:Vector3|undefined,lastSlope:number|undefined,maxSlopeDelta=0,maxSlope=0,maxUpStep=0,maxUphillSlope=0;
const routeSamples=Array.from({length:501},(_,i)=>{
  const p=routeCurve.getPoint(i/500),height=groundHeight(p.x,p.z);
  let slope=0;
  if(lastPoint&&lastHeight!==undefined){const dl=p.distanceTo(lastPoint);distance+=dl;slope=(height-lastHeight)/dl;maxUpStep=Math.max(maxUpStep,height-lastHeight);maxUphillSlope=Math.max(maxUphillSlope,slope);maxSlope=Math.max(maxSlope,Math.abs(slope));if(lastSlope!==undefined)maxSlopeDelta=Math.max(maxSlopeDelta,Math.abs(Math.atan(slope)-Math.atan(lastSlope))*180/Math.PI);}
  lastPoint=p;lastHeight=height;lastSlope=slope;
  return {t:i/500,u:round(p.x),d:round(p.z),elevation:round(height),distance:round(distance),slopeDegrees:round(Math.atan(slope)*180/Math.PI)};
});
// C0 / C1 boundary checks on both sides of the authored shoulder and farm transition.
let maxHeightGap=0,maxDerivativeGap=0,maxBoundaryLimitGap=0;
for(let u=-900;u<=900;u+=15)for(const d of [220,1120,2300,2600,shoulderDepth(u),shoulderDepth(u)+shoulderWidth(u)]){
  const eps=.001,h=groundHeight(u,d),left=groundHeight(u,d-eps),right=groundHeight(u,d+eps);
  maxHeightGap=Math.max(maxHeightGap,Math.abs(right-left));
  // Compare extrapolated limits, not two distinct elevations on a legitimate slope.
  const leftLimit=2*left-groundHeight(u,d-2*eps),rightLimit=2*right-groundHeight(u,d+2*eps);
  maxBoundaryLimitGap=Math.max(maxBoundaryLimitGap,Math.abs(leftLimit-rightLimit));
  maxDerivativeGap=Math.max(maxDerivativeGap,Math.abs((h-left)/eps-(right-h)/eps));
}
let maxFieldOffsetError=0;
let minRenderedFieldClearance=Infinity,maxRenderedFieldClearance=-Infinity,maxFieldSlopeDegrees=0;
const fields=buildFields();
fields.children.forEach(m=>{const mesh=m as Mesh;meshReports[mesh.name]=auditMesh(mesh.geometry);});
fields.children.filter(c=>c.name.endsWith('plot')).forEach((m)=>{
  const mesh=m as Mesh,p=mesh.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
    const u=(p.getX(i)-p.getZ(i))*Math.SQRT1_2,d=-(p.getX(i)+p.getZ(i))*Math.SQRT1_2;
    maxFieldOffsetError=Math.max(maxFieldOffsetError,Math.abs(p.getY(i)-groundHeight(u,d)-.8));
    const clearance=p.getY(i)-renderedGroundHeight(u,d);
    minRenderedFieldClearance=Math.min(minRenderedFieldClearance,clearance);maxRenderedFieldClearance=Math.max(maxRenderedFieldClearance,clearance);
    const du=(groundHeight(u+.1,d)-groundHeight(u-.1,d))/.2,dd=(groundHeight(u,d+.1)-groundHeight(u,d-.1))/.2;
    maxFieldSlopeDegrees=Math.max(maxFieldSlopeDegrees,Math.atan(Math.hypot(du,dd))*180/Math.PI);
  }
});
fields.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();(o.material as any).dispose();}});
const zones=buildMeadowZones();zones.traverse(o=>{if(o instanceof Mesh){meshReports[o.name]=auditMesh(o.geometry);o.geometry.dispose();(o.material as any).dispose();}});
const projectedFields=FIELDS.map(f=>{
  const points=[];
  for(let i=0;i<=60;i++)for(let j=0;j<=60;j++){
    const p=fieldPoint(f,i/60,j/60);points.push({...projectPoint(p.u,p.d,p.h),h:p.h});
  }
  return {id:f.id,points,bounds:{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))}};
});
const fieldSamples=projectedFields.map(f=>({id:f.id,min:round(Math.min(...f.points.map(p=>p.h))),max:round(Math.max(...f.points.map(p=>p.h))),screenBounds:Object.fromEntries(Object.entries(f.bounds).map(([key,value])=>[key,round(value)]))}));
const projection=measureProjection();
const placements=sceneLayout(),home=placements.find(a=>a.slot==='home')!;
const homeSupport=[];
for(let i=0;i<=30;i++)for(let j=0;j<=30;j++){
  // Sample the actual rotated Proxy footprint, not only its flat central area.
  const x=(i/30-.5)*home.footprint.width,z=(j/30-.5)*home.footprint.depth;
  const u=home.u+(x-z)*Math.SQRT1_2,d=home.d-(x+z)*Math.SQRT1_2;
  const du=(groundHeight(u+.1,d)-groundHeight(u-.1,d))/.2,dd=(groundHeight(u,d+.1)-groundHeight(u,d-.1))/.2;
  homeSupport.push({h:groundHeight(u,d),slope:Math.atan(Math.hypot(du,dd))*180/Math.PI});
}
const homeMaxSlope=Math.max(...homeSupport.map(p=>p.slope));
const mainRidge=RIDGES.find(r=>r.id==='near-fold')!;
const mainPeak=mainRidge.points.reduce((a,b)=>a.h>b.h?a:b);
const primaryField=projectedFields.find(f=>f.id==='tractor-plot')!;
const lowerField=projectedFields.find(f=>f.id==='lower-plot')!;
const fieldGaps=[];
for(let x=10;x<1190;x+=10){
  const upper=primaryField.points.filter(p=>Math.abs(p.x-x)<6);
  const lower=lowerField.points.filter(p=>Math.abs(p.x-x)<6);
  if(upper.length&&lower.length)fieldGaps.push(Math.min(...lower.map(p=>p.y))-Math.max(...upper.map(p=>p.y)));
}
const projectedFieldGap=Math.min(...fieldGaps);
// Actual final-frame projection, without the original SVG's unrelated 0.66 source transform.
const screenRelationships={homeCenter:home.target,primaryFieldTop:round(primaryField.bounds.top),primaryFieldBelowHomeCenter:round(primaryField.bounds.top-home.target.y),leftParcelMinimumGrassGap:round(projectedFieldGap),note:'Measured in the delivered 1200×800 orthographic frame. Other parcels may interleave with the meadow; artistic depth still requires screenshots.'};
const composition={homeFoot:home.target,homeMaxSlope:round(homeMaxSlope),homeHeightRange:homeSupport.map(p=>p.h).reduce((a,h)=>[Math.min(a[0],h),Math.max(a[1],h)],[Infinity,-Infinity]),mainRidgePeak:projectPoint(mainPeak.u,mainPeak.d,mainPeak.h),screenRelationships,placements:placements.map(a=>({slot:a.slot,u:a.u,d:a.d,h:round(a.h),screen:a.target}))};
const assertions={
  peaksBelowHome:ridgeReports.every(r=>r.belowMeadow),
  routeDescendsOverall:routeSamples.at(-1)!.elevation<routeSamples[0].elevation-30,
  routeRollingRiseUnder2Degrees:Math.atan(maxUphillSlope)*180/Math.PI<2,
  walkRouteUnder12Degrees:Math.atan(maxSlope)*180/Math.PI<12,
  routeSlopeStepUnderHalfDegree:maxSlopeDelta<.5,
  noHeightJump:maxBoundaryLimitGap<1e-6,
  continuousBoundaryDerivative:maxDerivativeGap<.001,
  fieldConformsToGround:maxFieldOffsetError<.001,
  fieldsStayAboveRenderedGround:minRenderedFieldClearance>0,
  fieldsRemainGentle:maxFieldSlopeDegrees<15,
  validMeshes:Object.values(meshReports).every(m=>m.nonFinite===0&&m.degenerate===0&&m.downwardNormals===0&&m.nonManifoldEdges===0&&m.maxNormalError<.001),
  projectionMatchesGroundAxes:projection.maxSlopeError<1e-8,
  homeRemainsStable:homeMaxSlope<4,
  primaryFieldVisuallyBelowHome:primaryField.bounds.top-home.target.y>15,
  primaryFieldFullyInFrame:primaryField.bounds.left>0&&primaryField.bounds.right<1200&&primaryField.bounds.top>0&&primaryField.bounds.bottom<800,
  leftParcelsSeparatedInProjection:fieldGaps.length>5&&projectedFieldGap>20,
  allNarrativeSlotsPresent:placements.length===10&&new Set(placements.map(a=>a.slot)).size===10,
};
const report={version:'0.3',units:'study units, not metres',cloudSeaRendered:false,passed:Object.values(assertions).every(Boolean),assertions,samples,ridges:ridgeReports,highestViewingRidge:Math.max(...ridgeReports.slice(0,6).map(p=>p.maxElevation)),composition,route:{length:round(distance),startElevation:routeSamples[0].elevation,endElevation:routeSamples.at(-1)!.elevation,maxSlopeDegrees:round(Math.atan(maxSlope)*180/Math.PI),maxUphillSlopeDegrees:round(Math.atan(maxUphillSlope)*180/Math.PI),maxAdjacentSlopeChangeDegrees:round(maxSlopeDelta),maxUpStep:round(maxUpStep),sampleCount:501},continuity:{probeEpsilon:.001,maxTwoSidedHeightGap:round(maxHeightGap),maxExtrapolatedLimitGap:maxBoundaryLimitGap,maxDerivativeGap:round(maxDerivativeGap)},fieldAttachment:{renderOffset:.8,maxOffsetError:round(maxFieldOffsetError)},fieldSamples,meshReports,projection,limitations:['Open mesh boundaries are intentional, outside the view or buried below the valley floor; no vertical island skirts.','These checks validate geometry and specific projected relationships, not artistic approval.','Generic narrative slots are independent of formal SVG assets.','Static SVG composition does not validate room transitions, interaction, dynamic parallax or individual foot collisions.']};
await fs.mkdir('evidence',{recursive:true});
Object.assign(report.fieldAttachment,{minRenderedClearance:round(minRenderedFieldClearance),maxRenderedClearance:round(maxRenderedFieldClearance),maxFieldSlopeDegrees:round(maxFieldSlopeDegrees)});
await fs.writeFile('public/geometry-report.json',JSON.stringify(report,null,2));
await fs.writeFile('evidence/geometry-report.json',JSON.stringify(report,null,2));
await fs.writeFile('evidence/walk-route.csv','t,u,d,elevation,distance,slopeDegrees\n'+routeSamples.map(p=>Object.values(p).join(',')).join('\n'));
console.log(JSON.stringify({passed:report.passed,assertions,screenRelationships,route:report.route,homeMaxSlope:round(homeMaxSlope),continuity:report.continuity,fieldAttachment:report.fieldAttachment,projection},null,2));
if(!report.passed)process.exitCode=1;
