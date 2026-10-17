import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three';
import Delaunator from 'delaunator';
import { valleyHeight, type RidgeDefinition } from './layout';
import { worldPoint } from '../world/projection';

// A branching landform, sampled independently from its rendering tessellation.
// Curved crests, concave aprons and unequal flanks replace straight pyramid faces.
export function ridgeSampler(def:RidgeDefinition) {
  const chains=[def.points,...(def.branches??[])].map((points,chainIndex)=>{
    const curve=new CatmullRomCurve3(points.map(p=>new Vector3(p.u,p.h,p.d)),false,'centripetal');
    const steps=Math.ceil(curve.getLength()/12);
    const samples=Array.from({length:steps+1},(_,i)=>{
      const t=i/steps,v=curve.getPoint(t),at=t*(points.length-1),k=Math.min(points.length-2,Math.floor(at));
      const width=points[k].w+(points[k+1].w-points[k].w)*(at-k);
      // Broad crest interruptions only, no noise texture or micro-displacement.
      v.y+=Math.sin(t*Math.PI)*(3.8*Math.sin(t*29+chainIndex)+2.2*Math.sin(t*53+chainIndex*2));
      return {u:v.x,d:v.z,h:v.y,w:width};
    });
    return samples;
  });
  const all=chains.flat(),extent=Math.max(1,...(def.flanks??[1,1]));
  const bounds={minU:Math.min(...all.map(p=>p.u-p.w*extent)),maxU:Math.max(...all.map(p=>p.u+p.w*extent)),minD:Math.min(...all.map(p=>p.d-p.w*extent*1.4)),maxD:Math.max(...all.map(p=>p.d+p.w*extent*1.4))};
  const segments=chains.map(chain=>chain.slice(1).map((b,i)=>{
    const a=chain[i],dx=b.u-a.u,dz=(b.d-a.d)/1.4,len2=dx*dx+dz*dz;
    return {a,b,dx,dz,len2,len:Math.sqrt(len2)};
  }));
  function heightAt(u:number,d:number) {
    const base=valleyHeight(u,d)-2;
    let height=base;
    for(const chain of segments){
      let chainHeight=base;
      for(const {a,b,dx,dz,len2,len} of chain){
        const f=Math.max(0,Math.min(1,((u-a.u)*dx+(d-a.d)/1.4*dz)/len2));
        const cu=a.u+f*(b.u-a.u),cd=a.d+f*(b.d-a.d),crest=a.h+f*(b.h-a.h),width=a.w+f*(b.w-a.w);
        const offsetU=u-cu,offsetD=(d-cd)/1.4;
        const across=(dx*offsetD-dz*offsetU)/len,along=(dx*offsetU+dz*offsetD)/len;
        const dist=Math.hypot(along,across/(def.flanks?.[across>0?0:1]??1));
        // A small rounded crown, long upper face and a concave slope-to-valley toe.
        const radius=(Math.sqrt(dist*dist+14*14)-14)/width;
        const influence=Math.pow(Math.max(0,1-radius),1.75);
        chainHeight=Math.max(chainHeight,base+Math.max(0,crest-base)*influence);
      }
      // Smooth only junctions between complete branches, not every sampling segment.
      if(chainHeight<base+.1)continue;
      const blend=height>base+.1?Math.max(0,1-Math.abs(height-chainHeight)/24):0;
      height=Math.max(height,chainHeight)+blend*blend*6;
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
  const unique=[...new Map(sites.map(p=>[`${p[0].toFixed(3)},${p[1].toFixed(3)}`,p])).values()];
  const elevations=unique.map(([u,d])=>heightAt(u,d)),triangulation=Delaunator.from(unique),indices:number[]=[];
  for(let i=0;i<triangulation.triangles.length;i+=3){
    const ids=[triangulation.triangles[i],triangulation.triangles[i+1],triangulation.triangles[i+2]];
    if(ids.every(k=>elevations[k]<valleyHeight(...unique[k])+.2))continue;
    const [a,b,c]=ids.map(k=>worldPoint(unique[k][0],unique[k][1],elevations[k]));
    if(b.clone().sub(a).cross(c.clone().sub(a)).y<0)[ids[1],ids[2]]=[ids[2],ids[1]];
    indices.push(...ids);
  }
  const used=[...new Set(indices)],remap=new Map(used.map((v,i)=>[v,i]));
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(used.flatMap(k=>worldPoint(unique[k][0],unique[k][1],elevations[k]).toArray()),3));
  g.setIndex(indices.map(i=>remap.get(i)!));g.computeVertexNormals();return g;
}
