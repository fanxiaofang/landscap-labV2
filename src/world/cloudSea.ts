import { Group, Vector3, Mesh, MeshBasicMaterial, Float32BufferAttribute } from 'three';
import { indexedSurface } from '../terrain/geometry';
import { worldPoint } from './projection';
import { cloudHeight, cloudColor } from './cloudField';
export { cloudHeight } from './cloudField';

// Connected basin fill with nonuniform rounded billows and real depth occlusion.
export function buildCloudSea() {
  const group=new Group();group.name='static-basin-cloud-billows';
  const g=indexedSurface(400,350,(s,t)=>{
    const u=-2700+5400*s,d=550+5000*t;
    return worldPoint(u,d,cloudHeight(u,d));
  });
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),colors:number[]=[];
  for(let i=0;i<p.count;i++){
    const u=(p.getX(i)-p.getZ(i))*Math.SQRT1_2,d=-(p.getX(i)+p.getZ(i))*Math.SQRT1_2;
    colors.push(...cloudColor(u,d,new Vector3().fromBufferAttribute(n,i)).toArray());
  }
  g.setAttribute('color',new Float32BufferAttribute(colors,3));
  const m=new Mesh(g,new MeshBasicMaterial({vertexColors:true}));m.name='connected-cloud-volume-top';
  group.add(m);group.visible=false;return group;
}
