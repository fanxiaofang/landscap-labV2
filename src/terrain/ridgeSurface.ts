import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three';
import Delaunator from 'delaunator';
import { groundHeight, smooth, RIDGES, GROUND_GRID, type RidgeDefinition } from './layout';
import { worldPoint } from '../world/projection';

// A branching landform, sampled independently from its rendering tessellation.
// Curved crests, concave aprons and unequal flanks replace straight pyramid faces.
export function ridgeSampler(def:RidgeDefinition) {
  const chains=[def.points,...(def.branches??[])].map(points=>{
    const curve=new CatmullRomCurve3(points.map(p=>new Vector3(p.u,p.h,p.d)),false,'centripetal');
    const steps=Math.ceil(curve.getLength()/12);
    const samples=Array.from({length:steps+1},(_,i)=>{
      const t=i/steps,v=curve.getPoint(t),at=t*(points.length-1),k=Math.min(points.length-2,Math.floor(at));
      const width=points[k].w+(points[k+1].w-points[k].w)*(at-k);
      // The authored crest provides the rhythm. Repeated sinusoidal displacement
      // made small ridges look pleated and is not a substitute for a saddle.
      return {u:v.x,d:v.z,h:v.y,w:width};
    });
    return samples;
  });
  const all=chains.flat(),extent=Math.max(1,...(def.flanks??[1,1]));
  const bounds={minU:Math.min(...all.map(p=>p.u-p.w*extent))-32,maxU:Math.max(...all.map(p=>p.u+p.w*extent))+32,minD:Math.min(...all.map(p=>p.d-p.w*extent*1.4))-45,maxD:Math.max(...all.map(p=>p.d+p.w*extent*1.4))+45};
  const segments=chains.map(chain=>chain.slice(1).map((b,i)=>{
    const a=chain[i],dx=b.u-a.u,dz=(b.d-a.d)/1.4,len2=dx*dx+dz*dz;
    return {a,b,dx,dz,len2,len:Math.sqrt(len2)};
  }));
  function heightAt(u:number,d:number) {
    // The apron meets the actual meadow/basin surface, including near shoulders.
    const base=groundHeight(u,d)-2;
    let height=base;
    for(const chain of segments){
      let maximum=0,weighted=0,totalLength=0;
      for(const {a,b,dx,dz,len2,len} of chain){
        const f=len2>1e-8?Math.max(0,Math.min(1,((u-a.u)*dx+(d-a.d)/1.4*dz)/len2)):0;
        const cu=a.u+f*(b.u-a.u),cd=a.d+f*(b.d-a.d),crest=a.h+f*(b.h-a.h),width=a.w+f*(b.w-a.w);
        const offsetU=u-cu,offsetD=(d-cd)/1.4;
        const across=(dx*offsetD-dz*offsetU)/Math.max(len,1e-4),along=(dx*offsetU+dz*offsetD)/Math.max(len,1e-4);
        const dist=Math.hypot(along,across/(def.flanks?.[across>0?0:1]??1));
        // A small rounded crown, long upper face and a concave slope-to-valley toe.
        const radius=(Math.sqrt(dist*dist+24*24)-24)/width;
        const influence=Math.pow(Math.max(0,1-radius),1.75);
        // Length-normalised log-sum-exp keeps the envelope continuous through
        // sample hand-offs, without raising a ridge when sample density grows.
        const relief=Math.max(0,crest-base)*influence,weight=Math.max(len,.001),softness=4;
        if(relief>maximum){weighted*=Math.exp((maximum-relief)/softness);maximum=relief;}
        weighted+=weight*Math.exp((relief-maximum)/softness);totalLength+=weight;
      }
      // Smooth only junctions between complete branches, not every sampling segment.
      // Fade the blend by relief: an unattenuated smooth maximum creates a
      // raised rim where two nearly-flat toes meet the basin (visible in clay).
      const chainHeight=base+Math.max(0,maximum+4*Math.log(weighted/totalLength));
      const blend=Math.max(0,1-Math.abs(height-chainHeight)/48);
      const junction=smooth(0,48,Math.min(height-base,chainHeight-base));
      height=Math.max(height,chainHeight)+blend*blend*12*junction;
    }
    return Math.max(base,height-1.5);
  }
  return {heightAt,bounds,chains};
}

export function ridgeGeometry(def:RidgeDefinition) {
  const {heightAt,bounds,chains}=ridgeSampler(def),{minU,maxU,minD,maxD}=bounds;
  const sites:[number,number][]=[];
  for(const chain of chains)for(const p of chain)sites.push([p.u,p.d]);
  const cols=Math.ceil((maxU-minU)/15),rows=Math.ceil((maxD-minD)/19);
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=minU+(maxU-minU)*(i+(j%2)*.36)/cols,d=minD+(maxD-minD)*j/rows;
    sites.push([u,d]);
  }
  const unique=[...new Map(sites.map(([u,d])=>{const p:[number,number]=[Math.round(u*10)/10,Math.round(d*10)/10];return [`${p[0]},${p[1]}`,p] as const;})).values()];
  const elevations=unique.map(([u,d])=>heightAt(u,d)),triangulation=Delaunator.from(unique),indices:number[]=[];
  for(let i=0;i<triangulation.triangles.length;i+=3){
    const ids=[triangulation.triangles[i],triangulation.triangles[i+1],triangulation.triangles[i+2]];
    if(ids.every(k=>elevations[k]<groundHeight(...unique[k])+.2))continue;
    const [a,b,c]=ids.map(k=>worldPoint(unique[k][0],unique[k][1],elevations[k]));
    if(b.clone().sub(a).cross(c.clone().sub(a)).y<0)[ids[1],ids[2]]=[ids[2],ids[1]];
    indices.push(...ids);
  }
  const used=[...new Set(indices)],remap=new Map(used.map((v,i)=>[v,i]));
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(used.flatMap(k=>worldPoint(unique[k][0],unique[k][1],elevations[k]).toArray()),3));
  g.setIndex(indices.map(i=>remap.get(i)!));g.computeVertexNormals();return g;
}

export function createTerrainSampler() {
  const ridges=RIDGES.map(def=>({def,...ridgeSampler(def)}));
  function sample(u:number,d:number) {
    const ground=groundHeight(u,d);
    let h=ground,dominantRelief=0,atmosphere=0;
    for(const ridge of ridges){
      const b=ridge.bounds;
      if(u<b.minU||u>b.maxU||d<b.minD||d>b.maxD)continue;
      const height=ridge.heightAt(u,d),relief=Math.max(0,height-ground);
      if(relief<=0)continue;
      if(relief>dominantRelief){dominantRelief=relief;atmosphere=ridge.def.atmosphere;}
      const blend=Math.max(0,1-Math.abs(h-height)/32);
      h=Math.max(h,height)+8*blend*blend*smooth(0,32,Math.min(h-ground,relief));
    }
    return {h,relief:h-ground,atmosphere};
  }
  return {sample,ridges};
}

// One connected heightfield. Separate overlaid meshes could meet in position
// while keeping different normals, producing visible apron rims in free view.
// Shared triangles and normals make meadow, valley and all ridge toes one land.
export function terrainGeometry() {
  const {sample,ridges}=createTerrainSampler(),grid=GROUND_GRID;
  const sites:[number,number][]=[];
  for(let j=0;j<=grid.rows;j++)for(let i=0;i<=grid.cols;i++){
    sites.push([grid.minU+i*grid.width/grid.cols,grid.minD+j*grid.depth/grid.rows]);
  }
  for(const ridge of ridges){
    for(const chain of ridge.chains)for(const p of chain)sites.push([p.u,p.d]);
    const {minU,maxU,minD,maxD}=ridge.bounds;
    const cols=Math.ceil((maxU-minU)/21),rows=Math.ceil((maxD-minD)/25);
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++)sites.push([minU+i*(maxU-minU)/cols,minD+j*(maxD-minD)/rows]);
  }
  const unique=[...new Map(sites.map(p=>[`${p[0].toFixed(3)},${p[1].toFixed(3)}`,p])).values()];
  const values=unique.map(([u,d])=>sample(u,d)),indices=Array.from(Delaunator.from(unique).triangles);
  for(let i=0;i<indices.length;i+=3){
    const [a,b,c]=[unique[indices[i]],unique[indices[i+1]],unique[indices[i+2]]];
    if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  }
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(unique.flatMap(([u,d],i)=>worldPoint(u,d,values[i].h).toArray()),3));
  g.setAttribute('relief',new Float32BufferAttribute(values.map(v=>v.relief),1));
  g.setAttribute('atmosphere',new Float32BufferAttribute(values.map(v=>v.atmosphere),1));
  g.setIndex(indices);g.computeVertexNormals();
  return g;
}
