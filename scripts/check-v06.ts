import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as layout from '../src/terrain/layout';
import { ridgeGeometry } from '../src/terrain/ridgeSurface';
import { cloudHeight, CLOUD_REGIONS, CLOUD_BILLOWS } from '../src/world/cloudField';
import { projectPoint } from '../src/world/projection';

// Historical assertion: V0.7 intentionally removes uniform group scaling.
// Fail clearly if run against a later authoring model; do not recreate that
// obsolete constraint in the current terrain just to satisfy this script.
if(!('RIDGE_PLACEMENTS' in layout))throw new Error('Historical V0.6 check: run at afcb308. Use npm run check:geometry for the current terrain.');
const {RIDGES,valleyHeight}=layout;
const RIDGE_PLACEMENTS=layout.RIDGE_PLACEMENTS as Record<string,{scale:number}>;

const before=JSON.parse(await fs.readFile('evidence/v05/geometry-report.json','utf8'));
const groups=[];
for(const def of RIDGES){
  const g=ridgeGeometry(def),p=g.getAttribute('position'),n=g.getAttribute('normal');
  for(let i=0;i<p.count;i++){
    assert.ok([p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite));
    assert.ok(n.getY(i)>=-1e-5);
  }
  if(RIDGE_PLACEMENTS[def.id]){
    const peak=def.points.reduce((a,b)=>a.h>b.h?a:b),screen=projectPoint(peak.u,peak.d,peak.h);
    const old=before.ridges.find((r:any)=>r.id===def.id).controls.reduce((a:any,b:any)=>a.terrain>b.terrain?a:b);
    assert.ok(peak.d>old.d,`${def.id} must actually recede`);
    assert.ok(RIDGE_PLACEMENTS[def.id].scale<1);
    const screenShift=Math.hypot(screen.x-old.screen.x,screen.y-old.screen.y);
    assert.ok(screenShift>5,`${def.id} must not retain the old screen silhouette`);
    groups.push({id:def.id,scale:RIDGE_PLACEMENTS[def.id].scale,retreat:peak.d-old.d,screenShift,peak,screen});
  }
  g.dispose();
}
const channel=[{u:-350,d:2100},{u:25,d:3000},{u:380,d:3500}].map(p=>({...p,clearance:cloudHeight(p.u,p.d)-valleyHeight(p.u,p.d)}));
assert.ok(channel.every(p=>p.clearance>0));
assert.equal(CLOUD_REGIONS.length,6);assert.ok(CLOUD_BILLOWS.length<40);
const report={passed:true,groups,cloudRegions:CLOUD_REGIONS.length,localBillows:CLOUD_BILLOWS.length,channel,scope:'Three requested revisions only; art approval pending'};
await fs.writeFile('.reference-cache/v06/geometry-check.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
