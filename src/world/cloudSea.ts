import { Color, Group, Vector3 } from 'three';
import { indexedSurface } from '../terrain/geometry';
import { worldPoint } from './projection';
import { Mesh, MeshBasicMaterial, Float32BufferAttribute } from 'three';

// One opaque, low-relief surface. Static vertex colors and depth testing only.
// It is a composition placeholder, not a volumetric cloud or a weather system.
const lobes=[[-700,2000,230,420,32],[-250,1650,300,450,48],[270,1480,260,380,28],[680,1050,320,380,52],[-480,2800,240,420,30],[70,2850,350,410,38],[560,2440,280,440,28],[-80,3800,420,420,28],[680,3700,360,430,24]];
export function cloudHeight(u:number,d:number) {
  let h=-240-.19*Math.max(0,d-1800)+110*Math.exp(-(((d-1600)/700)**2))+65*Math.exp(-(((d-3100)/600)**2));
  // Shallow fixed corridors expose the authored shoulders while keeping the valley connected.
  h-=35*Math.exp(-(((u-610)/330)**2)-((d-1600)/510)**2);
  h-=32*Math.exp(-(((u-195)/380)**2)-((d-2120)/420)**2);
  for(const [x,z,rx,rz,amp] of lobes)h+=amp*Math.exp(-(((u-x)/rx)**2)-((d-z)/rz)**2);
  // Fixed staggered soft lobes: a small static relief, with no particles or time input.
  for(let row=0;row<14;row++)for(let col=0;col<18;col++){
    const x=-1500+col*185+(row%2)*87+24*Math.sin(col*2.3+row),z=800+row*245+35*Math.cos(col+row*1.7);
    h+=(12+7*Math.sin(col*1.9+row*2.1))*Math.exp(-(((u-x)/110)**2)-((d-z)/180)**2);
  }
  return h+9*Math.sin(u/130+d/175)*Math.cos(d/145);
}
export function buildCloudSea() {
  const group=new Group();group.name='static-cloud-sea-placeholder';
  const g=indexedSurface(160,170,(s,t)=>{
    const u=-2600+5200*s,d=550+3850*t+35*Math.sin(u/170)*t;
    return worldPoint(u,d,cloudHeight(u,d));
  });
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),colors:number[]=[];
  const light=new Vector3(.2,.95,-.7).normalize();
  for(let i=0;i<p.count;i++){
    const v=new Vector3().fromBufferAttribute(n,i),d=-(p.getX(i)+p.getZ(i))*Math.SQRT1_2;
    const facing=Math.max(0,v.dot(light));
    const c=new Color('#c39cae').lerp(new Color('#ffe1a8'),Math.min(1,Math.max(0,(facing-.66)*3.5)));
    c.lerp(new Color('#f8c997'),Math.max(0,Math.min(.34,(d-2800)/4000)));
    colors.push(...c.toArray());
  }
  g.setAttribute('color',new Float32BufferAttribute(colors,3));
  group.add(new Mesh(g,new MeshBasicMaterial({vertexColors:true})));
  group.visible=false;return group;
}
